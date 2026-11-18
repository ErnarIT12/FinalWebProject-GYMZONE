"use strict";

/*
 * Safe localStorage access shared by every script. Private browsing, blocked site data or a
 * full disk make localStorage throw, so reads fall back to a default value and writes report
 * success with true or false instead of throwing. Loaded in <head> after theme.js.
 */
const SESSION_STORAGE_KEY = "gymzone-session";

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

// True when the browser lets the site save data at all.
function isStorageAvailable() {
    const probe = "gymzone-probe";
    try {
        localStorage.setItem(probe, probe);
        localStorage.removeItem(probe);
        return true;
    } catch {
        return false;
    }
}

// Search history belongs to one account, so each user (and the guest) gets its own key:
// "gymzone-explorer:anna@gmail.com" or "gymzone-explorer:guest".
function accountKey(base, email = readStorage(SESSION_STORAGE_KEY, null)) {
    const owner = typeof email === "string" && email.includes("@") ? email : "guest";
    return `${base}:${owner}`;
}

// Older versions kept one shared search history for everybody. It is removed so one person's
// searches never show up in another person's profile.
removeStorage("gymzone-explorer");
removeStorage("gymzone-library");
