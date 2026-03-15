document.addEventListener("DOMContentLoaded", () => {
    const popup = document.querySelector("[data-status-popup]");
    if (!popup) {
        return;
    }

    function closePopup() {
        popup.remove();
    }

    popup.querySelectorAll("[data-status-popup-close]").forEach((button) => {
        button.addEventListener("click", closePopup);
    });

    popup.addEventListener("click", (event) => {
        if (event.target === popup) {
            closePopup();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closePopup();
        }
    });
});
