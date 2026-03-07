document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("delete-char-modal");
    const nameNode = document.getElementById("delete-char-name");
    const form = document.getElementById("delete-char-form");
    const cancelBtn = document.getElementById("delete-char-cancel");

    if (!modal || !nameNode || !form || !cancelBtn) {
        return;
    }

    modal.hidden = true;

    const closeModal = () => {
        modal.hidden = true;
    };

    const openModal = (charUid, charName) => {
        nameNode.textContent = `«${charName}»`;
        form.action = `/user/characters/${charUid}/request-delete`;
        modal.hidden = false;
    };

    function closeAllMenus() {
        document.querySelectorAll(".card-menu.open").forEach((node) => {
            node.classList.remove("open");
        });
    }

    document.querySelectorAll("[data-delete-open]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();

            const charUid = button.dataset.charUid;
            const charName = button.dataset.charName || "без имени";

            if (!charUid) {
                return;
            }

            closeAllMenus();
            openModal(charUid, charName);
        });
    });

    document.querySelectorAll("[data-menu-toggle]").forEach((toggle) => {
        toggle.addEventListener("click", (event) => {
            event.stopPropagation();

            const menu = toggle.closest(".card-menu");
            if (!menu) {
                return;
            }

            const isOpen = menu.classList.contains("open");
            closeAllMenus();

            if (!isOpen) {
                menu.classList.add("open");
            }
        });
    });

    document.addEventListener("click", () => {
        closeAllMenus();
    });

    cancelBtn.addEventListener("click", () => {
        closeModal();
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
            closeAllMenus();
        }
    });
});
