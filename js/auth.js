"use strict";

/*
 * Authentication simulation. There is no backend, so accounts live in localStorage:
 *   gymzone-users    array of user objects (name, email, phone, goal, password hash, favorites)
 *   gymzone-session  email of the user who is logged in
 * Form checks come from validateForm() in main.js. This file only runs when they pass.
 */
const USERS_KEY = "gymzone-users";
const SESSION_KEY = "gymzone-session";

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
        focus: "Start light. Read the three technique steps before each exercise and watch the animation in the movement gallery.",
        link: "index.html#gallery",
    },
};

// Reads JSON from localStorage. Broken or missing data gives the fallback value.
function readStorage(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

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

const authStore = {
    getUsers() {
        return readStorage(USERS_KEY, []);
    },

    findUser(email) {
        return this.getUsers().find((user) => user.email === email.trim().toLowerCase());
    },

    currentUser() {
        const email = readStorage(SESSION_KEY, null);
        return email ? this.findUser(email) : undefined;
    },

    async register({ name, email, phone, goal, password }) {
        const users = this.getUsers();
        const user = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            goal,
            passwordHash: await hashPassword(password),
            createdAt: new Date().toISOString(),
            favorites: [],
        };
        users.push(user);
        writeStorage(USERS_KEY, users);
        return user;
    },

    // Replaces some fields of the logged-in user and saves the list.
    updateCurrent(changes) {
        const current = this.currentUser();
        if (!current) return undefined;
        const users = this.getUsers().map((user) =>
            user.email === current.email ? { ...user, ...changes } : user,
        );
        writeStorage(USERS_KEY, users);
        return this.currentUser();
    },

    logIn(email) {
        writeStorage(SESSION_KEY, email.trim().toLowerCase());
    },

    logOut() {
        localStorage.removeItem(SESSION_KEY);
    },

    deleteCurrent() {
        const current = this.currentUser();
        if (!current) return;
        writeStorage(
            USERS_KEY,
            this.getUsers().filter((user) => user.email !== current.email),
        );
        this.logOut();
    },

    isFavorite(id) {
        return Boolean(this.currentUser()?.favorites.some((item) => item.id === id));
    },

    // Adds or removes a library exercise. Returns true when it is now saved,
    // false when it was removed, and null when nobody is logged in.
    toggleFavorite(exercise) {
        const user = this.currentUser();
        if (!user) return null;
        const saved = user.favorites.some((item) => item.id === exercise.id);
        const favorites = saved
            ? user.favorites.filter((item) => item.id !== exercise.id)
            : [...user.favorites, exercise];
        this.updateCurrent({ favorites });
        return !saved;
    },
};

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

// Show/Hide buttons next to password fields.
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

function initializeSignup() {
    const form = document.querySelector("#signup-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        // main.js has already cancelled the event and shown messages if a field is invalid.
        if (event.defaultPrevented) return;
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));

        if (authStore.findUser(values.email)) {
            const emailField = form.elements.email;
            showFieldError(
                emailField,
                "An account with this email already exists. Log in instead.",
            );
            emailField.focus();
            setFormStatus(form, "Please use another email or log in.", true);
            return;
        }

        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        await authStore.register(values);
        playSuccessSound();
        setFormStatus(form, "Account created! Taking you to the log in page...");
        showToast("Account created. Please log in.");
        window.setTimeout(() => {
            // The email is passed in sessionStorage, not in the address bar.
            sessionStorage.setItem("gymzone-registered", values.email.trim().toLowerCase());
            window.location.href = "login.html?registered=1";
        }, 1200);
    });
}

function initializeLogin() {
    const form = document.querySelector("#login-form");
    if (!form) return;
    const notice = document.querySelector("#login-notice");
    const params = new URLSearchParams(window.location.search);

    // Messages passed from other pages through the address bar.
    let message = "";
    if (params.has("registered")) {
        form.elements.email.value = sessionStorage.getItem("gymzone-registered") || "";
        sessionStorage.removeItem("gymzone-registered");
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
        if (event.defaultPrevented) return;
        event.preventDefault();
        const { email, password } = Object.fromEntries(new FormData(form));
        const user = authStore.findUser(email);

        // The same message for a wrong email or password, so accounts cannot be guessed.
        if (!user || user.passwordHash !== (await hashPassword(password))) {
            form.elements.password.value = "";
            setFormStatus(form, "The email or password is incorrect. Please try again.", true);
            form.elements.password.focus();
            return;
        }

        authStore.logIn(user.email);
        playSuccessSound();
        setFormStatus(form, `Welcome back, ${user.name}! Opening your profile...`);
        window.setTimeout(() => {
            window.location.href = "profile.html";
        }, 900);
    });
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
        remove.addEventListener("click", () => {
            authStore.toggleFavorite(exercise);
            renderSavedExercises(authStore.currentUser());
            showToast(`${exercise.name} removed.`);
        });
        item.append(text, remove);
        list.append(item);
    }
}

// Shows the last searches from the Exercise Explorer and the Library, if there are any.
function renderLastSearch() {
    const output = document.querySelector("#last-search");
    const explorer = readStorage("gymzone-explorer", null);
    const library = readStorage("gymzone-library", null);
    const parts = [];
    if (explorer?.query) parts.push(`"${explorer.query}" in the Exercise Explorer`);
    if (library?.query) parts.push(`"${library.query}" in the Library`);
    output.hidden = parts.length === 0;
    output.textContent = parts.length ? `Your last searches: ${parts.join(" and ")}.` : "";
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

    document.title = `${firstName}'s Profile | GYMZONE`;
    document.querySelector("#profile-greeting").textContent = `WELCOME, ${firstName.toUpperCase()}`;
    document.querySelector("#profile-avatar").textContent = initials;
    document.querySelector("#profile-name").textContent = user.name;
    document.querySelector("#profile-goal-label").textContent = goal.label;
    document.querySelector("#profile-email").textContent = user.email;
    document.querySelector("#profile-phone").textContent = user.phone;
    document.querySelector("#profile-since").textContent = new Date(
        user.createdAt,
    ).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    document.querySelector("#focus-text").textContent = goal.focus;
    document.querySelector("#focus-link").href = goal.link;
    renderSavedExercises(user);
    renderLastSearch();
}

function initializeProfile() {
    const form = document.querySelector("#profile-edit-form");
    if (!form) return;
    const user = authStore.currentUser();
    if (!user) {
        // The profile is private: guests are sent to the log in page.
        window.location.replace("login.html?next=profile");
        return;
    }

    renderProfile(user);
    form.elements.name.value = user.name;
    form.elements.phone.value = user.phone;
    form.elements.goal.value = user.goal;

    form.addEventListener("submit", (event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        const { name, phone, goal } = Object.fromEntries(new FormData(form));
        const updated = authStore.updateCurrent({ name: name.trim(), phone: phone.trim(), goal });
        renderProfile(updated);
        updateAccountLinks();
        setFormStatus(form, "Your changes are saved.");
        showToast("Profile updated.");
    });

    document.querySelector("#logout-button").addEventListener("click", () => {
        authStore.logOut();
        window.location.href = "login.html?loggedout=1";
    });

    document.querySelector("#delete-account-button").addEventListener("click", () => {
        const confirmed = window.confirm(
            "Delete your GYMZONE account? Your profile and saved exercises will be removed from this browser.",
        );
        if (!confirmed) return;
        authStore.deleteCurrent();
        window.location.href = "signup.html";
    });
}

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
