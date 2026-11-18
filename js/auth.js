"use strict";

/*
 * Authentication simulation. There is no backend, so accounts live in localStorage:
 *   gymzone-users    array of user objects (name, email, phone, goal, password hash, favorites)
 *   gymzone-session  email of the user who is logged in
 * Field checks come from main.js: an invalid form never reaches the handlers in this file.
 * Storage helpers (readStorage, writeStorage, accountKey) come from storage.js.
 */
const USERS_KEY = "gymzone-users";
const SESSION_KEY = SESSION_STORAGE_KEY;

const STORAGE_ERROR =
    "Your browser does not let this site save data (for example in private mode or with site data blocked). Allow site data for this page and try again.";
const SESSION_CHANGED =
    "The account changed in another tab. This page now shows the account that is logged in, so please check it and try again.";

const GOALS = {
    strength: {
        label: "Build strength",
        focus: "Three heavy sessions a week built around the squat, bench press and Romanian deadlift. Rest two to three minutes between sets.",
        link: "quads.html",
    },
    muscle: {
        label: "Build muscle",
        focus: "Four sessions a week, split into upper and lower body days. Aim for 8 to 12 controlled reps per set.",
        link: "upper.html",
    },
    endurance: {
        label: "Improve endurance",
        focus: "Two or three CrossFit sessions a week with burpees, box jumps and kettlebell swings in short rounds.",
        link: "crossfit.html",
    },
    technique: {
        label: "Learn proper technique",
        focus: "Start light. Find an exercise in the Exercise Explorer, read its three technique steps and watch the animation before each set.",
        link: "index.html#exercise-explorer",
    },
};

// Passwords are never stored as plain text. SHA-256 needs a secure context (https or
// localhost). When the page is opened from a file, a simple fallback hash keeps the demo working.
async function hashPassword(password) {
    if (window.crypto?.subtle) {
        const bytes = new TextEncoder().encode(password);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    }
    let hash = 5381;
    for (const char of password) hash = (hash * 33) ^ char.codePointAt(0);
    return `fallback-${(hash >>> 0).toString(16)}`;
}

// Saved data can be edited by hand or come from an older version of the site. Only records
// with the fields the site needs are kept, so a broken entry can never crash a page.
function normalizeUser(raw) {
    if (!raw || typeof raw !== "object") return null;
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (
        !email.includes("@") ||
        !name ||
        typeof raw.passwordHash !== "string" ||
        !raw.passwordHash
    ) {
        return null;
    }
    const favorites = Array.isArray(raw.favorites)
        ? raw.favorites
              .filter((item) => item && Number.isInteger(item.id) && typeof item.name === "string")
              .map(({ id, name: title, category, equipment }) => ({
                  id,
                  name: title,
                  category: typeof category === "string" ? category : "",
                  equipment: typeof equipment === "string" ? equipment : "",
              }))
        : [];
    return {
        name,
        email,
        phone: typeof raw.phone === "string" ? raw.phone : "",
        goal: raw.goal in GOALS ? raw.goal : "technique",
        passwordHash: raw.passwordHash,
        createdAt: Number.isNaN(Date.parse(raw.createdAt)) ? "" : raw.createdAt,
        favorites,
    };
}

// Two tabs can save at the same moment. The Web Locks API lets one tab at a time change the
// user list. The task itself reads and writes with no await in between, so even without
// Web Locks another tab cannot slip a change in the middle.
async function withUsersLock(task) {
    if (navigator.locks?.request) return navigator.locks.request(USERS_KEY, task);
    return task();
}

const authStore = {
    getUsers() {
        const raw = readStorage(USERS_KEY, []);
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        return raw.map(normalizeUser).filter((user) => {
            if (!user || seen.has(user.email)) return false;
            seen.add(user.email);
            return true;
        });
    },

    findUser(email) {
        const wanted = String(email).trim().toLowerCase();
        return this.getUsers().find((user) => user.email === wanted);
    },

    // The logged-in user, or undefined for a guest or a session that points nowhere.
    currentUser() {
        const email = readStorage(SESSION_KEY, null);
        return typeof email === "string" ? this.findUser(email) : undefined;
    },

    // Every change is tied to the account the page shows. If another tab logged in as someone
    // else in the meantime, nothing is changed and the caller gets { ok: false, error: "session" }.
    isActive(email) {
        return this.currentUser()?.email === email;
    },

    // Returns { ok: true, user } or { ok: false, error: "exists" | "storage" }.
    async register({ name, email, phone, goal, password }) {
        const passwordHash = await hashPassword(password);
        return withUsersLock(() => {
            const user = normalizeUser({
                name,
                email,
                phone: phone.trim(),
                goal,
                passwordHash,
                createdAt: new Date().toISOString(),
                favorites: [],
            });
            const users = this.getUsers();
            if (users.some((item) => item.email === user.email))
                return { ok: false, error: "exists" };
            if (!writeStorage(USERS_KEY, [...users, user]) || !this.findUser(user.email)) {
                return { ok: false, error: "storage" };
            }
            return { ok: true, user };
        });
    },

    // Changes some fields of the account with this email, only while it is the active one.
    async updateUser(email, changes) {
        return withUsersLock(() => {
            if (!this.isActive(email)) return { ok: false, error: "session" };
            const users = this.getUsers().map((user) =>
                user.email === email ? normalizeUser({ ...user, ...changes }) : user,
            );
            if (!writeStorage(USERS_KEY, users)) return { ok: false, error: "storage" };
            return { ok: true, user: this.findUser(email) };
        });
    },

    async deleteUser(email) {
        return withUsersLock(() => {
            if (!this.isActive(email)) return { ok: false, error: "session" };
            const users = this.getUsers().filter((user) => user.email !== email);
            if (!writeStorage(USERS_KEY, users)) return { ok: false, error: "storage" };
            removeStorage(SESSION_KEY);
            removeStorage(accountKey("gymzone-explorer", email));
            removeStorage(accountKey("gymzone-library", email));
            return { ok: true };
        });
    },

    logIn(email) {
        return writeStorage(SESSION_KEY, email);
    },

    logOut() {
        return removeStorage(SESSION_KEY);
    },

    isFavorite(id, email) {
        const user = this.currentUser();
        return Boolean(
            user && user.email === email && user.favorites.some((item) => item.id === id),
        );
    },

    // Adds or removes a library exercise for the account with this email. Returns
    // { ok: true, saved } or { ok: false, error: "guest" | "session" | "storage" }.
    async toggleFavorite(exercise, email) {
        if (!email) return { ok: false, error: "guest" };
        const user = this.findUser(email);
        if (!user || !this.isActive(email)) return { ok: false, error: "session" };
        const saved = user.favorites.some((item) => item.id === exercise.id);
        const favorites = saved
            ? user.favorites.filter((item) => item.id !== exercise.id)
            : [...user.favorites, exercise];
        const result = await this.updateUser(email, { favorites });
        return result.ok ? { ok: true, saved: !saved } : result;
    },
};

function errorMessage(error) {
    if (error === "session") return SESSION_CHANGED;
    if (error === "storage") return STORAGE_ERROR;
    return "Something went wrong. Please try again.";
}

// The menu shows "Log in" for guests and "Profile" for a logged-in user.
function updateAccountLinks() {
    const user = authStore.currentUser();
    document.querySelectorAll("[data-account-link]").forEach((link) => {
        link.href = user ? "profile.html" : "login.html";
        link.textContent = user ? `Profile · ${user.name.split(" ")[0]}` : "Log in";
    });
    document.querySelectorAll("[data-join-link]").forEach((link) => {
        link.href = user ? "profile.html" : "signup.html";
        link.textContent = user ? "My profile" : "Join GYMZONE";
    });
}

// Writes a message under a form. Errors use the error color.
function setFormStatus(form, message, isError = false) {
    const status = form.querySelector(".form-status");
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

// Show/Hide buttons next to password fields. Validation does not depend on input.type
// (see isPasswordField in main.js), so the rules stay the same in both states.
function initializePasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
        const input = document.getElementById(button.dataset.togglePassword);
        button.addEventListener("click", () => {
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            button.textContent = show ? "Hide" : "Show";
            button.setAttribute("aria-pressed", String(show));
            button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        });
    });
}

// Live checklist and strength bar under the sign-up password.
function initializePasswordMeter() {
    const input = document.querySelector("#signup-password");
    const bar = document.querySelector("[data-strength-bar]");
    if (!input || !bar) return;
    const items = document.querySelectorAll("[data-password-check]");
    const levels = ["", "weak", "weak", "fair", "good", "strong"];

    input.addEventListener("input", () => {
        const failed = getPasswordProblems(input.value).map((check) => check.key);
        items.forEach((item) => {
            item.classList.toggle("is-met", !failed.includes(item.dataset.passwordCheck));
        });
        const passed = input.value ? PASSWORD_CHECKS.length - failed.length : 0;
        bar.style.width = `${(passed / PASSWORD_CHECKS.length) * 100}%`;
        bar.dataset.level = levels[passed];
    });
}

// Warns right away on the sign up and log in pages when the browser blocks saved data.
function warnIfStorageBlocked(form) {
    if (!isStorageAvailable()) setFormStatus(form, STORAGE_ERROR, true);
}

function initializeSignup() {
    const form = document.querySelector("#signup-form");
    if (!form) return;
    const button = form.querySelector('[type="submit"]');

    form.addEventListener("submit", async (event) => {
        // Data never leaves the browser: the default submission is always cancelled.
        event.preventDefault();
        if (!isStorageAvailable()) {
            setFormStatus(form, STORAGE_ERROR, true);
            return;
        }
        const values = Object.fromEntries(new FormData(form));
        button.disabled = true;
        let created = false;
        try {
            const result = await authStore.register(values);
            if (result.error === "exists") {
                const emailField = form.elements.email;
                showFieldError(
                    emailField,
                    "An account with this email already exists. Log in instead.",
                );
                emailField.focus();
                setFormStatus(form, "Please use another email or log in.", true);
                return;
            }
            if (!result.ok) {
                setFormStatus(form, errorMessage(result.error), true);
                return;
            }
            created = true;
            playSuccessSound();
            setFormStatus(form, "Account created! Taking you to the log in page...");
            showToast("Account created. Please log in.");
            // The email is passed in sessionStorage, not in the address bar.
            try {
                sessionStorage.setItem("gymzone-registered", result.user.email);
            } catch {
                // The log in page then simply starts with an empty email field.
            }
            window.setTimeout(() => {
                window.location.href = "login.html?registered=1";
            }, 1200);
        } catch {
            setFormStatus(form, "Something went wrong. Please try again.", true);
        } finally {
            if (!created) button.disabled = false;
        }
    });
    warnIfStorageBlocked(form);
    enableSubmit(form);
}

function initializeLogin() {
    const form = document.querySelector("#login-form");
    if (!form) return;
    const button = form.querySelector('[type="submit"]');
    const notice = document.querySelector("#login-notice");
    const params = new URLSearchParams(window.location.search);

    // Short messages passed from other pages. Only fixed flags are in the address bar.
    let message = "";
    if (params.has("registered")) {
        try {
            form.elements.email.value = sessionStorage.getItem("gymzone-registered") || "";
            sessionStorage.removeItem("gymzone-registered");
        } catch {
            // Without sessionStorage the user types the email again.
        }
        message = "Your account is ready. Enter your password to log in.";
    } else if (params.get("next") === "profile") {
        message = "Please log in to see your profile.";
    } else if (params.has("loggedout")) {
        message = "You have logged out. See you at your next workout!";
    }
    if (message) {
        notice.textContent = message;
        notice.hidden = false;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!isStorageAvailable()) {
            setFormStatus(form, STORAGE_ERROR, true);
            return;
        }
        const { email, password } = Object.fromEntries(new FormData(form));
        button.disabled = true;
        let loggedIn = false;
        try {
            const user = authStore.findUser(email);
            // The same message for a wrong email or password, so accounts cannot be guessed.
            if (!user || user.passwordHash !== (await hashPassword(password))) {
                form.elements.password.value = "";
                setFormStatus(form, "The email or password is incorrect. Please try again.", true);
                form.elements.password.focus();
                return;
            }
            if (!authStore.logIn(user.email)) {
                setFormStatus(form, STORAGE_ERROR, true);
                return;
            }
            loggedIn = true;
            playSuccessSound();
            setFormStatus(form, `Welcome back, ${user.name}! Opening your profile...`);
            window.setTimeout(() => {
                window.location.href = "profile.html";
            }, 900);
        } catch {
            setFormStatus(form, "Something went wrong. Please try again.", true);
        } finally {
            if (!loggedIn) button.disabled = false;
        }
    });
    warnIfStorageBlocked(form);
    enableSubmit(form);
}

// Shows the last searches of this account from the Exercise Explorer and the Library.
function renderLastSearch(email) {
    const output = document.querySelector("#last-search");
    const explorer = readStorage(accountKey("gymzone-explorer", email), null);
    const library = readStorage(accountKey("gymzone-library", email), null);
    const parts = [];
    if (typeof explorer?.query === "string" && explorer.query) {
        parts.push(`"${explorer.query}" in the Exercise Explorer`);
    }
    if (typeof library?.query === "string" && library.query) {
        parts.push(`"${library.query}" in the Library`);
    }
    output.hidden = parts.length === 0;
    output.textContent = parts.length ? `Your last searches: ${parts.join(" and ")}.` : "";
}

function initializeProfile() {
    const form = document.querySelector("#profile-edit-form");
    if (!form) return;
    const main = document.querySelector("#main-content");
    // The account this tab shows. Every action checks it is still the logged-in one.
    let viewedEmail = null;

    function leaveProfile() {
        // Another tab logged out or deleted the account: hide the data before leaving.
        viewedEmail = null;
        main.replaceChildren();
        window.location.replace("login.html?next=profile");
    }

    function renderSavedExercises(user) {
        const list = document.querySelector("#saved-list");
        const empty = document.querySelector("#saved-empty");
        const count = document.querySelector("#saved-count");
        list.replaceChildren();
        empty.hidden = user.favorites.length > 0;
        count.textContent = user.favorites.length
            ? `${user.favorites.length} saved exercise${user.favorites.length === 1 ? "" : "s"}.`
            : "";

        for (const exercise of user.favorites) {
            const item = document.createElement("li");
            item.className = "saved-item";
            const text = document.createElement("div");
            const name = document.createElement("h3");
            name.className = "h6 mb-1";
            name.textContent = exercise.name;
            const meta = document.createElement("p");
            meta.className = "mb-0";
            meta.textContent = [exercise.category, exercise.equipment].filter(Boolean).join(" · ");
            text.append(name, meta);

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "btn btn-secondary btn-sm";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove ${exercise.name} from saved exercises`);
            remove.addEventListener("click", async () => {
                const result = await authStore.toggleFavorite(exercise, viewedEmail);
                if (!result.ok) {
                    showToast(errorMessage(result.error), "error");
                    syncWithSession();
                    return;
                }
                renderProfile(authStore.currentUser());
                showToast(`${exercise.name} removed.`);
            });
            item.append(text, remove);
            list.append(item);
        }
    }

    function renderProfile(user) {
        const goal = GOALS[user.goal] ?? GOALS.technique;
        const initials = user.name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        const firstName = user.name.split(" ")[0];
        const since = Date.parse(user.createdAt);

        document.title = `${firstName}'s Profile | GYMZONE`;
        document.querySelector("#profile-greeting").textContent =
            `WELCOME, ${firstName.toUpperCase()}`;
        document.querySelector("#profile-avatar").textContent = initials;
        document.querySelector("#profile-name").textContent = user.name;
        document.querySelector("#profile-goal-label").textContent = goal.label;
        document.querySelector("#profile-email").textContent = user.email;
        document.querySelector("#profile-phone").textContent = user.phone || "Not added";
        document.querySelector("#profile-since").textContent = Number.isNaN(since)
            ? "Unknown"
            : new Date(since).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
              });
        document.querySelector("#focus-text").textContent = goal.focus;
        document.querySelector("#focus-link").href = goal.link;
        renderSavedExercises(user);
        renderLastSearch(user.email);
    }

    // Shows another account and resets the edit form to its details.
    function showAccount(user) {
        viewedEmail = user.email;
        form.reset();
        form.elements.name.value = user.name;
        form.elements.phone.value = user.phone;
        form.elements.goal.value = user.goal;
        renderProfile(user);
    }

    // Called when another tab changes the session or the saved users, and before reporting a
    // failed action. The page always ends up showing the account that is really logged in.
    function syncWithSession() {
        const user = authStore.currentUser();
        if (!user) {
            leaveProfile();
            return;
        }
        if (user.email !== viewedEmail) {
            showAccount(user);
            setFormStatus(form, SESSION_CHANGED, true);
        } else {
            renderProfile(user);
        }
        updateAccountLinks();
    }

    const user = authStore.currentUser();
    if (!user) {
        // The profile is private: guests are sent to the log in page.
        leaveProfile();
        return;
    }
    showAccount(user);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        const { name, phone, goal } = Object.fromEntries(new FormData(form));
        button.disabled = true;
        try {
            const result = await authStore.updateUser(viewedEmail, {
                name: name.trim(),
                phone: phone.trim(),
                goal,
            });
            if (!result.ok) {
                if (result.error === "session") syncWithSession();
                setFormStatus(form, errorMessage(result.error), true);
                return;
            }
            renderProfile(result.user);
            updateAccountLinks();
            setFormStatus(form, "Your changes are saved.");
            showToast("Profile updated.");
        } catch {
            setFormStatus(form, "Something went wrong. Please try again.", true);
        } finally {
            button.disabled = false;
        }
    });
    enableSubmit(form);

    document.querySelector("#logout-button").addEventListener("click", () => {
        authStore.logOut();
        window.location.href = "login.html?loggedout=1";
    });

    document.querySelector("#delete-account-button").addEventListener("click", async () => {
        const confirmed = window.confirm(
            `Delete the GYMZONE account ${viewedEmail}? The profile and saved exercises will be removed from this browser.`,
        );
        if (!confirmed) return;
        const result = await authStore.deleteUser(viewedEmail);
        if (!result.ok) {
            showToast(errorMessage(result.error), "error");
            syncWithSession();
            return;
        }
        window.location.href = "signup.html";
    });

    // "storage" fires when another tab changes localStorage. A null key means it was cleared.
    window.addEventListener("storage", (event) => {
        if (event.key === null || event.key === SESSION_KEY || event.key === USERS_KEY) {
            syncWithSession();
        }
    });
    // A page restored from the back/forward cache may show an old session.
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) syncWithSession();
    });
}

// Every page keeps the menu in step with logins and logouts in other tabs.
window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === SESSION_KEY || event.key === USERS_KEY) {
        updateAccountLinks();
    }
});

// Logged-in users do not need the log in or sign up forms.
if (authStore.currentUser() && document.querySelector("#login-form, #signup-form")) {
    window.location.replace("profile.html");
}

updateAccountLinks();
initializePasswordToggles();
initializePasswordMeter();
initializeSignup();
initializeLogin();
initializeProfile();
