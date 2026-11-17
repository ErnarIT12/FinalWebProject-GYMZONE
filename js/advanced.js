"use strict";

// Arrow keys, Home and End move focus through the main menu.
function initializeKeyboardNavigation() {
    const menu = document.querySelector(".navbar-nav");
    if (!menu) return;

    menu.addEventListener("keydown", (event) => {
        // Key combinations stay with the browser, for example Alt+Left to go back.
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        // Only visible links count, so the collapsed mobile menu is skipped.
        const links = [...menu.querySelectorAll(".nav-link")].filter(
            (link) => link.getClientRects().length > 0,
        );
        const index = links.indexOf(event.target.closest(".nav-link"));
        if (index < 0) return;

        let nextIndex;
        switch (event.key) {
            case "ArrowRight":
            case "ArrowDown":
                nextIndex = (index + 1) % links.length;
                break;
            case "ArrowLeft":
            case "ArrowUp":
                nextIndex = (index - 1 + links.length) % links.length;
                break;
            case "Home":
                nextIndex = 0;
                break;
            case "End":
                nextIndex = links.length - 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        links[nextIndex].focus();
    });
}

// Builds one exercise card. The image stays a placeholder until script.js lazy-loads it.
function createExerciseCard(exercise) {
    const column = document.createElement("div");
    column.className = "col-12 col-sm-6 col-lg-4 catalog-result";
    column.dataset.exerciseId = exercise.id;

    const card = document.createElement("article");
    card.className = "card bootstrap-card h-100";
    const image = document.createElement("img");
    image.className = "card-img-top lazy-image";
    image.src = LAZY_PLACEHOLDER;
    image.dataset.src = exercise.image;
    image.alt = exercise.alt;

    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h3");
    title.className = "card-title h4";
    title.textContent = exercise.name;
    const description = document.createElement("p");
    description.className = "card-text";
    description.textContent = exercise.description;
    const link = document.createElement("a");
    link.className = "btn btn-outline-primary btn-sm";
    link.href = exercise.guide;
    link.textContent = "Technique guide";
    link.setAttribute("aria-label", `${exercise.name}: technique guide`);

    body.append(title, description, link);
    card.append(image, body);
    column.append(card);
    return column;
}

// Category buttons rebuild the card list from exerciseLibrary.
function initializeExerciseFilters() {
    const results = document.querySelector("#exercise-results");
    if (!results) return;
    const buttons = [...document.querySelectorAll("[data-exercise-filter]")];
    const count = document.querySelector("#exercise-count");

    function renderCategory(category) {
        const exercises = exerciseLibrary.getByCategory(category);
        const fragment = document.createDocumentFragment();
        for (const exercise of exercises) {
            fragment.append(createExerciseCard(exercise));
        }
        results.replaceChildren(fragment);
        count.textContent = `${exercises.length} exercises shown: ${exerciseLibrary.getCategoryLabel(category)}.`;
        buttons.forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.exerciseFilter === category));
        });
    }

    buttons.forEach((button) => {
        button.disabled = false;
        button.addEventListener("click", () => renderCategory(button.dataset.exerciseFilter));
    });
    renderCategory("all");
}

// Clicking a thumbnail changes the large image, its text and the guide link.
function initializeMovementGallery() {
    const thumbnails = document.querySelector("#gallery-thumbnails");
    if (!thumbnails) return;
    const image = document.querySelector("#gallery-display");
    const title = document.querySelector("#gallery-title");
    const description = document.querySelector("#gallery-description");
    const guide = document.querySelector("#gallery-guide");
    const status = document.querySelector("#gallery-status");

    function selectExercise(id, animate = true) {
        const exercise = exerciseLibrary.findById(id);
        if (!exercise) return;
        // The first image waits for lazy loading. A click shows the new one at once.
        image.dataset.src = exercise.image;
        if (animate) image.setAttribute("src", exercise.image);
        image.setAttribute("alt", exercise.alt);
        title.textContent = exercise.name;
        description.textContent = exercise.description;
        guide.setAttribute("href", exercise.guide);
        guide.setAttribute("aria-label", `${exercise.name}: open technique guide`);
        thumbnails.querySelectorAll("button").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.exerciseId === id));
        });
        status.textContent = `Selected exercise: ${exercise.name}.`;
        if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            image.getAnimations().forEach((animation) => animation.cancel());
            image.animate(
                [
                    { opacity: 0.35, transform: "scale(0.98)" },
                    { opacity: 1, transform: "scale(1)" },
                ],
                { duration: 240, easing: "ease-out" },
            );
        }
    }

    const fragment = document.createDocumentFragment();
    for (const exercise of exerciseLibrary.items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-thumbnail";
        button.dataset.exerciseId = exercise.id;
        button.setAttribute("aria-label", `Show ${exercise.name}`);
        button.setAttribute("aria-controls", "gallery-display");
        const thumbnail = document.createElement("img");
        thumbnail.className = "lazy-image";
        thumbnail.src = LAZY_PLACEHOLDER;
        thumbnail.dataset.src = exercise.image;
        thumbnail.alt = "";
        const label = document.createElement("span");
        label.textContent = exercise.name;
        button.append(thumbnail, label);
        button.addEventListener("click", () => selectExercise(exercise.id));
        fragment.append(button);
    }
    thumbnails.replaceChildren(fragment);
    selectExercise(exerciseLibrary.items[0].id, false);
}

// Sound toggle (saved in localStorage). One audio element restarts on each play, so sounds never overlap.
// Returns the function that plays the success sound.
function initializeSoundEffects() {
    const audio = document.querySelector("#completion-sound");
    const button = document.querySelector("#toggle-sound");
    const status = document.querySelector("#sound-status");
    if (!audio || !button) return () => {};
    // The choice is saved, so sound stays on when the user moves to another page.
    let enabled = localStorage.getItem("gymzone-sound") === "on";

    function renderButton() {
        button.setAttribute("aria-pressed", String(enabled));
        button.textContent = enabled ? "Sound: On" : "Sound: Off";
    }

    function playSuccessSound() {
        if (!enabled) return;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.35;
        audio.play().catch((error) => {
            if (!enabled || error.name === "AbortError") return;
            status.textContent = "Sound could not play. Check your browser audio settings.";
        });
    }

    button.addEventListener("click", () => {
        enabled = !enabled;
        localStorage.setItem("gymzone-sound", enabled ? "on" : "off");
        renderButton();
        status.textContent = enabled ? "Sound enabled. Playing a preview." : "Sound muted.";
        if (enabled) playSuccessSound();
        else {
            audio.pause();
            audio.currentTime = 0;
        }
    });
    audio.addEventListener("ended", () => {
        status.textContent = "Sound ready.";
    });
    renderButton();
    return playSuccessSound;
}

initializeKeyboardNavigation();
initializeExerciseFilters();
initializeMovementGallery();
// auth.js plays this sound after a successful sign up or log in.
const playSuccessSound = initializeSoundEffects();
