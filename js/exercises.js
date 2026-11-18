"use strict";

// The 21 exercises from the technique guides. The Exercise Explorer search, filters and
// suggestions use this list, and each guide link opens the exercise on its guide page.
const exerciseLibrary = {
    items: [
        {
            id: "bench-press",
            name: "Bench Press",
            category: "upper",
            image: "images/Barbell-Bench-Press.gif",
            alt: "Bench Press movement",
            description: "A basic exercise for building chest strength.",
            guide: "chest.html#bench-press",
        },
        {
            id: "incline-dumbbell-press",
            name: "Incline Dumbbell Press",
            category: "upper",
            image: "images/Incline-Dumbbell-Press.gif",
            alt: "Incline Dumbbell Press movement",
            description: "Targets the upper part of the chest.",
            guide: "chest.html#incline-dumbbell-press",
        },
        {
            id: "push-ups",
            name: "Push-Ups",
            category: "upper",
            image: "images/Push-up.gif",
            alt: "Push-Ups movement",
            description: "A simple bodyweight chest exercise.",
            guide: "chest.html#push-ups",
        },
        {
            id: "pull-ups",
            name: "Pull-Ups",
            category: "upper",
            image: "images/Pull-up.gif",
            alt: "Pull-Ups movement",
            description: "A bodyweight exercise that targets the upper back and arms.",
            guide: "back.html#pull-ups",
        },
        {
            id: "t-bar-row",
            name: "T-bar Row",
            category: "upper",
            image: "images/T-bar Row.gif",
            alt: "T-bar Row movement",
            description: "A compound exercise for building back strength.",
            guide: "back.html#t-bar-row",
        },
        {
            id: "lat-pulldown",
            name: "Lat Pulldown",
            category: "upper",
            image: "images/Lat-Pulldown.gif",
            alt: "Lat Pulldown movement",
            description: "Targets the latissimus dorsi and upper back.",
            guide: "back.html#lat-pulldown",
        },
        {
            id: "overhead-press",
            name: "Overhead Press",
            category: "upper",
            image: "images/Overhead Press.gif",
            alt: "Overhead Press movement",
            description: "A basic exercise for overall shoulder strength.",
            guide: "shoulders.html#overhead-press",
        },
        {
            id: "lateral-raises",
            name: "Lateral Raises",
            category: "upper",
            image: "images/Lateral Raises.gif",
            alt: "Lateral Raises movement",
            description: "Helps develop the side deltoids and shoulder width.",
            guide: "shoulders.html#lateral-raises",
        },
        {
            id: "front-raises",
            name: "Front Raises",
            category: "upper",
            image: "images/Front Raises.gif",
            alt: "Front Raises movement",
            description: "Targets the front part of the shoulders.",
            guide: "shoulders.html#front-raises",
        },
        {
            id: "barbell-curl",
            name: "Barbell Curl",
            category: "upper",
            image: "images/Barbell Curl.gif",
            alt: "Barbell Curl movement",
            description: "A classic exercise for building the biceps.",
            guide: "arms.html#barbell-curl",
        },
        {
            id: "hammer-curl",
            name: "Hammer Curl",
            category: "upper",
            image: "images/Hammer Curl.gif",
            alt: "Hammer Curl movement",
            description: "Works the biceps and forearm muscles.",
            guide: "arms.html#hammer-curl",
        },
        {
            id: "triceps-pushdown",
            name: "Triceps Pushdown",
            category: "upper",
            image: "images/Triceps Pushdown.gif",
            alt: "Triceps Pushdown movement",
            description: "An effective cable exercise for the triceps.",
            guide: "arms.html#triceps-pushdown",
        },
        {
            id: "barbell-squat",
            name: "Barbell Squat",
            category: "lower",
            image: "images/Barbell Squat.gif",
            alt: "Barbell Squat movement",
            description: "A compound exercise that strongly trains the legs.",
            guide: "quads.html#barbell-squat",
        },
        {
            id: "leg-press",
            name: "Leg Press",
            category: "lower",
            image: "images/Leg Press.gif",
            alt: "Leg Press movement",
            description: "Machine exercise focused on the quadriceps.",
            guide: "quads.html#leg-press",
        },
        {
            id: "leg-extension",
            name: "Leg Extension",
            category: "lower",
            image: "images/LEG-EXTENSION.gif",
            alt: "Leg Extension movement",
            description: "Isolates the quadriceps using a machine.",
            guide: "quads.html#leg-extension",
        },
        {
            id: "romanian-deadlift",
            name: "Romanian Deadlift",
            category: "lower",
            image: "images/Romanian Deadlift.gif",
            alt: "Romanian Deadlift movement",
            description: "Targets the hamstrings, glutes and lower back.",
            guide: "hamstrings.html#romanian-deadlift",
        },
        {
            id: "leg-curl",
            name: "Leg Curl",
            category: "lower",
            image: "images/Leg Curl.gif",
            alt: "Leg Curl movement",
            description: "An isolation exercise for the hamstrings.",
            guide: "hamstrings.html#leg-curl",
        },
        {
            id: "hip-thrust",
            name: "Hip Thrust",
            category: "lower",
            image: "images/Hip Thrust.gif",
            alt: "Hip Thrust movement",
            description: "A popular exercise for the glutes.",
            guide: "hamstrings.html#hip-thrust",
        },
        {
            id: "burpees",
            name: "Burpees",
            category: "conditioning",
            image: "images/Burpees.gif",
            alt: "Burpees movement",
            description: "A full-body exercise that increases endurance.",
            guide: "crossfit.html#burpees",
        },
        {
            id: "box-jumps",
            name: "Box Jumps",
            category: "conditioning",
            image: "images/Box Jumps.gif",
            alt: "Box Jumps movement",
            description: "A plyometric exercise for explosive leg power.",
            guide: "crossfit.html#box-jumps",
        },
        {
            id: "kettlebell-swing",
            name: "Kettlebell Swing",
            category: "conditioning",
            image: "images/Kettlebell Swing.gif",
            alt: "Kettlebell Swing movement",
            description: "Develops hip power, strength and endurance.",
            guide: "crossfit.html#kettlebell-swing",
        },
    ],

    // Returns one exercise, or undefined if the id is unknown.
    findById(id) {
        return this.items.find((exercise) => exercise.id === id);
    },

    // Returns the exercises for a filter button. An unknown category returns an empty list.
    getByCategory(category) {
        switch (category) {
            case "upper":
            case "lower":
            case "conditioning":
                return this.items.filter((exercise) => exercise.category === category);
            case "all":
                return [...this.items];
            default:
                return [];
        }
    },

    // Returns the text shown to the user for a category value.
    getCategoryLabel(category) {
        switch (category) {
            case "upper":
                return "Upper Body";
            case "lower":
                return "Lower Body";
            case "conditioning":
                return "CrossFit";
            default:
                return "All categories";
        }
    },
};
