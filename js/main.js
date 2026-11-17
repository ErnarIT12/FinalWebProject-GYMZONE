"use strict";

// Shows the visitor's local date and time and updates it every second.
function initializeClock() {
    const clock = document.querySelector("#current-datetime");
    if (!clock) return;

    const dateFormat = new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    const timeFormat = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    });

    function updateClock() {
        const now = new Date();
        clock.dateTime = now.toISOString();
        clock.textContent = `${dateFormat.format(now)}, ${timeFormat.format(now)}`;
    }

    updateClock();
    window.setInterval(updateClock, 1000);
}

// FAQ: each question button opens or closes its answer panel.
function initializeAccordion() {
    document.querySelectorAll(".faq-question").forEach((button) => {
        const panel = document.getElementById(button.getAttribute("aria-controls"));
        button.addEventListener("click", () => {
            const expanded = button.getAttribute("aria-expanded") !== "true";
            button.setAttribute("aria-expanded", String(expanded));
            panel.setAttribute("aria-hidden", String(!expanded));
            // An inert panel stays out of the keyboard order while it is closed.
            panel.inert = !expanded;
            panel.classList.toggle("is-open", expanded);
        });
    });
}

/*
 * Form validation. The browser's built-in checks are switched off with novalidate, and fields
 * never use required, pattern, minlength or type="email". Each field describes its rules with
 * data attributes instead:
 *   data-required        the field must be filled in (or checked, or one radio chosen)
 *   data-rule="..."      name | email | phone | password
 *   data-match="id"      must equal the field with that id (password confirmation)
 *   data-min-length="n"  / data-max-length="n"  text length limits
 *   data-label, data-message  wording used in the error messages
 */
// Words of letters joined by single spaces, hyphens or apostrophes: "Anna-Maria O'Neil".
const NAME_PATTERN = /^\p{L}+(?:[ '-]\p{L}+)*$/u;
// Local part: letters, digits and . _ % + - without a dot at either end.
const EMAIL_LOCAL_PATTERN = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*$/;
// Domain: labels that do not start or end with a hyphen, then a top-level domain of letters.
const EMAIL_DOMAIN_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
// Popular mail services. A domain one or two typos away from these is probably a mistake.
const KNOWN_EMAIL_DOMAINS = [
    "gmail.com",
    "mail.ru",
    "yandex.ru",
    "yandex.kz",
    "inbox.ru",
    "list.ru",
    "bk.ru",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "yahoo.com",
    "astanait.edu.kz",
];
// Real services that look like typos of the ones above, so they are never "corrected".
const OTHER_REAL_DOMAINS = ["mail.com", "email.com", "ymail.com", "gmx.com", "live.com", "me.com"];
const PHONE_PATTERN = /^\+?\d{10,15}$/;

// Each password check has a key (used by the checklist on the sign-up page) and its message.
const PASSWORD_CHECKS = [
    { key: "length", text: "at least 8 characters", test: (value) => value.length >= 8 },
    { key: "upper", text: "an uppercase letter", test: (value) => /[A-Z]/.test(value) },
    { key: "lower", text: "a lowercase letter", test: (value) => /[a-z]/.test(value) },
    { key: "digit", text: "a number", test: (value) => /\d/.test(value) },
    { key: "symbol", text: "a symbol", test: (value) => /[^A-Za-z0-9\s]/.test(value) },
];
const PASSWORD_MAX_LENGTH = 64;

function getPasswordProblems(value) {
    return PASSWORD_CHECKS.filter((check) => !check.test(value));
}

// Number of single-letter edits between two words (Levenshtein distance).
function editDistance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        }
        previous = current;
    }
    return previous[b.length];
}

// Returns an error for an email address, or an empty string when it looks correct.
function getEmailError(value) {
    const example = "Enter a valid email, for example name@gmail.com.";
    if (/\s/.test(value)) return "Email cannot contain spaces.";
    const parts = value.split("@");
    if (parts.length !== 2)
        return parts.length > 2 ? "Email can contain only one @ sign." : example;
    const [local, domain] = parts;
    if (!local) return "Add the part before @, for example name@gmail.com.";
    if (!domain) return "Add the part after @, for example name@gmail.com.";
    if (local.length > 64 || value.length > 254) return "This email is too long.";
    if (!EMAIL_LOCAL_PATTERN.test(local)) {
        return "The part before @ can use letters, numbers and . _ % + -, with no dot at the start, at the end or twice in a row.";
    }
    if (!domain.includes("."))
        return `Add the ending of the address, for example ${local}@${domain}.com.`;
    if (!EMAIL_DOMAIN_PATTERN.test(domain)) return example;

    const lowerDomain = domain.toLowerCase();
    if (KNOWN_EMAIL_DOMAINS.includes(lowerDomain) || OTHER_REAL_DOMAINS.includes(lowerDomain)) {
        return "";
    }
    const suggestion = KNOWN_EMAIL_DOMAINS.find((known) => editDistance(lowerDomain, known) <= 2);
    return suggestion ? `Check the address. Did you mean ${local}@${suggestion}?` : "";
}

// Joins ["a", "b", "c"] into "a, b and c" for readable messages.
function joinWords(words) {
    return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
}

// Returns the error message for a field, or an empty string when it is valid.
function getFieldError(field, form) {
    const data = field.dataset;
    const label = data.label || "This field";
    const isRequired = "required" in data;

    if (field.type === "radio") {
        const chosen = form.querySelector(`input[name="${field.name}"]:checked`);
        return isRequired && !chosen ? `Please choose ${label}.` : "";
    }
    if (field.type === "checkbox") {
        return isRequired && !field.checked ? data.message || `${label} must be checked.` : "";
    }

    // Passwords are compared exactly. Other text ignores spaces at the ends.
    const value = field.type === "password" ? field.value : field.value.trim();
    if (!value) {
        if (!isRequired) return "";
        return field.tagName === "SELECT" ? `Please choose ${label}.` : `${label} is required.`;
    }

    const minLength = Number(data.minLength);
    const maxLength = Number(data.maxLength);
    if (minLength && value.length < minLength) {
        return `${label} must be at least ${minLength} characters (now ${value.length}).`;
    }
    if (maxLength && value.length > maxLength) {
        return `${label} must be ${maxLength} characters or fewer (now ${value.length}).`;
    }

    switch (data.rule) {
        case "name":
            if (value.length < 2 || value.length > 50)
                return "Name must be 2 to 50 characters long.";
            if (!NAME_PATTERN.test(value)) {
                return "Use letters only. Words can be separated by one space, a hyphen or an apostrophe.";
            }
            break;
        case "email": {
            const emailError = getEmailError(value);
            if (emailError) return emailError;
            break;
        }
        case "phone": {
            if (/[^\d\s()+-]/.test(value)) {
                return "A phone number can contain only digits, spaces, brackets, dashes and a leading +.";
            }
            // Spaces, dashes and brackets help reading, so they are removed before the check.
            const digits = value.replace(/[\s()-]/g, "");
            if (!PHONE_PATTERN.test(digits)) {
                return "Enter a phone number with 10 to 15 digits, for example +7 701 234 5678.";
            }
            if (/^\+?(\d)\1+$/.test(digits)) return "This phone number does not look real.";
            break;
        }
        case "password": {
            if (/\s/.test(value)) return "Password cannot contain spaces.";
            if (value.length > PASSWORD_MAX_LENGTH) {
                return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
            }
            const problems = getPasswordProblems(value);
            if (problems.length) {
                return `Password needs ${joinWords(problems.map((check) => check.text))}.`;
            }
            break;
        }
    }

    if (data.match) {
        const original = form.querySelector(`#${data.match}`);
        if (original && value !== original.value) return "Passwords do not match.";
    }
    return "";
}

// Shows or clears a field's error message and updates its invalid state.
function showFieldError(field, message) {
    const errorId = field.type === "radio" ? `${field.name}-error` : `${field.id}-error`;
    const error = document.getElementById(errorId);
    if (error) error.textContent = message;
    field.classList.toggle("is-invalid", Boolean(message));
    if (message) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
}

// The fields of a form that have at least one rule. A radio group is checked once, through
// the radio that carries data-required.
function getValidatedFields(form) {
    return [
        ...form.querySelectorAll(
            "[data-required], [data-rule], [data-match], [data-min-length], [data-max-length]",
        ),
    ];
}

// Checks every field, shows the messages and focuses the first invalid one.
// Returns true when the whole form is valid. auth.js uses it as well.
function validateForm(form) {
    let firstInvalid = null;
    for (const field of getValidatedFields(form)) {
        const message = getFieldError(field, form);
        showFieldError(field, message);
        if (message && !firstInvalid) firstInvalid = field;
    }
    const status = form.querySelector(".form-status");
    if (firstInvalid) {
        if (status) {
            status.textContent = "Please correct the highlighted fields.";
            status.classList.add("is-error");
        }
        firstInvalid.focus();
    }
    return !firstInvalid;
}

// Validates every form with data-validate when it is submitted. A field is checked again when
// the user leaves it, and while typing once it already shows an error.
// Later submit handlers (spinner in script.js, auth.js) skip the event if it was cancelled here.
function initializeValidation() {
    document.querySelectorAll("form[data-validate]").forEach((form) => {
        const fields = getValidatedFields(form);
        const status = form.querySelector(".form-status");

        function checkField(field) {
            // For radios the message belongs to the radio with the rules.
            const target =
                field.type === "radio" ? fields.find((item) => item.name === field.name) : field;
            if (target) showFieldError(target, getFieldError(target, form));
        }

        function clearStatus() {
            if (status?.classList.contains("is-error")) {
                status.textContent = "";
                status.classList.remove("is-error");
            }
        }

        form.addEventListener("submit", (event) => {
            if (!validateForm(form)) event.preventDefault();
        });

        form.addEventListener("focusout", (event) => {
            const field = event.target;
            if (fields.includes(field) && field.value.trim() && field.type !== "radio")
                checkField(field);
        });

        form.addEventListener("input", (event) => {
            const field = event.target;
            if (field.getAttribute("aria-invalid") === "true") checkField(field);
            // A new password must re-check the confirmation that depends on it.
            fields
                .filter((item) => item.dataset.match === field.id && item.value)
                .forEach(checkField);
            clearStatus();
        });

        form.addEventListener("change", (event) => {
            const field = event.target;
            if (field.type === "radio" || field.type === "checkbox" || field.tagName === "SELECT") {
                checkField(field);
                clearStatus();
            }
        });

        form.addEventListener("reset", () => {
            fields.forEach((field) => showFieldError(field, ""));
            if (status) status.textContent = "";
        });
    });
}

initializeClock();
initializeAccordion();
initializeValidation();
