document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-content-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const root = button.closest(".character-content");
            if (!root) {
                return;
            }

            const extraItems = root.querySelectorAll(".content-id-chip.is-extra");
            const actions = root.querySelector("[data-content-actions]");

            extraItems.forEach((item) => {
                item.hidden = false;
            });

            button.hidden = true;

            if (actions) {
                actions.hidden = false;
            }
        });
    });

    document.querySelectorAll("[data-content-hide]").forEach((button) => {
        button.addEventListener("click", () => {
            const root = button.closest(".character-content");
            if (!root) {
                return;
            }

            const extraItems = root.querySelectorAll(".content-id-chip.is-extra");
            const showButton = root.querySelector("[data-content-toggle]");
            const actions = root.querySelector("[data-content-actions]");

            extraItems.forEach((item) => {
                item.hidden = true;
            });

            if (showButton) {
                showButton.hidden = false;
            }

            if (actions) {
                actions.hidden = true;
            }
        });
    });
});
