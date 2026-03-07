document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("char-create-form");
    const inputs = document.querySelectorAll(
        'input[type="checkbox"][data-pool][data-effect][data-cost]'
    );

    const submitBtn = document.getElementById("char-submit-btn");
    const submitState = document.querySelector(".js-submit-state");

    const roleTypeSelect = document.getElementById("char-role-type");
    const bodyTypeSelect = document.getElementById("body-type");

    const normalSections = document.getElementById("normal-character-sections");
    const loreSections = document.getElementById("lore-character-sections");
    const loreSlotInlineWrap = document.getElementById("lore-slot-inline-wrap");

    const nameField = document.getElementById("char-name");
    const descriptionField = document.getElementById("description");
    const backstoryField = document.getElementById("backstory");

    const loreTemplateRadios = document.querySelectorAll('input[type="radio"][name="lore_template_id"]');
    const loreTemplateSearch = document.getElementById("lore-template-search");

    const dynamicLinksRoot = document.getElementById("extra-content-list");

    const loreSlotModal = document.getElementById("lore-slot-modal");
    const openLoreSlotBtn = document.getElementById("open-lore-slot-request");
    const closeLoreSlotBtn = document.getElementById("close-lore-slot-modal");

    const requiredNormalFields = [
        nameField,
        bodyTypeSelect,
        descriptionField,
        backstoryField,
    ].filter(Boolean);

    function isFilled(field) {
        if (!field) {
            return true;
        }
        return field.value.trim() !== "";
    }

    function getSelectedLoreTemplate() {
        for (const radio of loreTemplateRadios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return "";
    }

    function clearNormalModeData() {
        requiredNormalFields.forEach((field) => {
            if ("value" in field) {
                field.value = "";
            }
        });

        document.querySelectorAll('#normal-character-sections input[type="checkbox"]').forEach((input) => {
            input.checked = false;
        });

        document.querySelectorAll('#normal-character-sections input[type="text"], #normal-character-sections input[type="url"], #normal-character-sections textarea').forEach((field) => {
            field.value = "";
        });

        if (dynamicLinksRoot) {
            dynamicLinksRoot.innerHTML = `
                <div class="dynamic-link-row">
                    <input
                        class="form-input dynamic-link-input"
                        type="text"
                        name="extra_content"
                        placeholder="Ссылка или Workshop ID"
                        data-dynamic-link-input
                    >
                    <button
                        type="button"
                        class="dynamic-link-remove"
                        data-dynamic-link-remove
                        aria-label="Удалить строку"
                        hidden
                    >
                        ×
                    </button>
                </div>
            `;
        }
    }

    function clearLoreModeData() {
        loreTemplateRadios.forEach((radio) => {
            radio.checked = false;
        });

        if (loreTemplateSearch) {
            loreTemplateSearch.value = "";
        }

        document.querySelectorAll("[data-lore-item]").forEach((item) => {
            item.hidden = false;
        });
    }

    function syncCharacterMode(previousMode = null) {
        if (!roleTypeSelect || !normalSections || !loreSections || !loreSlotInlineWrap) {
            return;
        }

        const mode = roleTypeSelect.value;
        const isLore = mode === "lore";
        const isNorm = mode === "norm";

        normalSections.hidden = !isNorm;
        loreSections.hidden = !isLore;
        loreSlotInlineWrap.hidden = !isLore;

        if (previousMode && previousMode !== mode) {
            if (mode === "lore") {
                clearNormalModeData();
            } else if (mode === "norm") {
                clearLoreModeData();
                closeLoreSlotModal();
            } else {
                clearNormalModeData();
                clearLoreModeData();
                closeLoreSlotModal();
            }
        }

        if (nameField) {
            nameField.required = isNorm;
        }
        if (bodyTypeSelect) {
            bodyTypeSelect.required = isNorm;
        }
        if (descriptionField) {
            descriptionField.required = isNorm;
        }
        if (backstoryField) {
            backstoryField.required = isNorm;
        }
    }

    function matchBodyType(itemBodyType, selectedBodyType) {
        if (!selectedBodyType) {
            return true;
        }
        if (!itemBodyType || itemBodyType === "any") {
            return true;
        }
        if (selectedBodyType === "bio" && itemBodyType === "true") {
            return true;
        }
        if (selectedBodyType === "synthetic" && itemBodyType === "false") {
            return true;
        }
        return false;
    }

    function applyBodyTypeFilter() {
        const selectedBodyType = bodyTypeSelect ? bodyTypeSelect.value : "";

        document.querySelectorAll("#normal-character-sections [data-trait-item]").forEach((item) => {
            const itemBodyType = item.dataset.isBio || "any";
            const visible = matchBodyType(itemBodyType, selectedBodyType);

            item.hidden = !visible;

            if (!visible) {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                }
            }
        });
    }

    function getPools() {
        let mech = 0;
        let rp = 0;

        for (const input of inputs) {
            if (!input.checked) {
                continue;
            }

            const pool = input.dataset.pool;
            const effect = input.dataset.effect;
            const cost = Number(input.dataset.cost || 0);
            const delta = effect === "plus" ? cost : -cost;

            if (pool === "mech") {
                mech += delta;
            } else if (pool === "rp") {
                rp += delta;
            }
        }

        return { mech, rp };
    }

    function renderPool(poolName, value) {
        const valueNodes = document.querySelectorAll(`[data-pool-value="${poolName}"]`);
        const cardNodes = document.querySelectorAll(`[data-pool-card="${poolName}"]`);

        valueNodes.forEach((node) => {
            node.textContent = value > 0 ? `+${value}` : `${value}`;
            node.classList.remove("is-good", "is-bad", "is-neutral");

            let cls = "is-neutral";
            if (value > 0) {
                cls = "is-good";
            } else if (value < 0) {
                cls = "is-bad";
            }

            node.classList.add(cls);
        });

        cardNodes.forEach((node) => {
            node.classList.remove("is-good", "is-bad", "is-neutral");

            let cls = "is-neutral";
            if (value > 0) {
                cls = "is-good";
            } else if (value < 0) {
                cls = "is-bad";
            }

            node.classList.add(cls);
        });
    }

    function validateNormal(mech, rp) {
        const missingRequired = requiredNormalFields.some((field) => !isFilled(field));

        if (missingRequired) {
            return {
                valid: false,
                text: "Заполните обязательные поля.",
                cls: "is-bad",
            };
        }

        if (mech < 0 && rp < 0) {
            return {
                valid: false,
                text: "Механический и РП пул ушли в минус.",
                cls: "is-bad",
            };
        }

        if (mech < 0) {
            return {
                valid: false,
                text: "Механический пул ушёл в минус.",
                cls: "is-bad",
            };
        }

        if (rp < 0) {
            return {
                valid: false,
                text: "РП пул ушёл в минус.",
                cls: "is-bad",
            };
        }

        return {
            valid: true,
            text: "Всё корректно.",
            cls: "is-good",
        };
    }

    function validateLore() {
        if (!getSelectedLoreTemplate()) {
            return {
                valid: false,
                text: "Выберите лорного персонажа.",
                cls: "is-bad",
            };
        }

        return {
            valid: true,
            text: "Всё корректно.",
            cls: "is-good",
        };
    }

    function updateState(previousMode = null) {
        syncCharacterMode(previousMode);
        applyBodyTypeFilter();

        const mode = roleTypeSelect ? roleTypeSelect.value : "";

        if (mode === "norm") {
            const { mech, rp } = getPools();
            renderPool("mech", mech);
            renderPool("rp", rp);

            const state = validateNormal(mech, rp);

            if (submitBtn) {
                submitBtn.disabled = !state.valid;
            }

            if (submitState) {
                submitState.classList.remove("is-good", "is-bad");
                submitState.textContent = state.text;
                submitState.classList.add(state.cls);
            }

            return;
        }

        if (mode === "lore") {
            const state = validateLore();

            if (submitBtn) {
                submitBtn.disabled = !state.valid;
            }

            if (submitState) {
                submitState.classList.remove("is-good", "is-bad");
                submitState.textContent = state.text;
                submitState.classList.add(state.cls);
            }

            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
        }

        if (submitState) {
            submitState.classList.remove("is-good", "is-bad");
            submitState.textContent = "Выберите тип персонажа.";
            submitState.classList.add("is-bad");
        }
    }

    function initTabs() {
        document.querySelectorAll("[data-tab-root]").forEach((root) => {
            const buttons = root.querySelectorAll("[data-tab-open]");
            const panes = root.querySelectorAll("[data-tab-pane]");

            buttons.forEach((button) => {
                button.addEventListener("click", () => {
                    const target = button.dataset.tabOpen;
                    if (!target) {
                        return;
                    }

                    buttons.forEach((item) => item.classList.remove("active"));
                    panes.forEach((pane) => pane.classList.remove("active"));

                    button.classList.add("active");

                    const pane = root.querySelector(`[data-tab-pane="${target}"]`);
                    if (pane) {
                        pane.classList.add("active");
                    }
                });
            });
        });
    }

    function initSearch() {
        document.querySelectorAll("[data-trait-search]").forEach((searchInput) => {
            searchInput.addEventListener("input", () => {
                const key = searchInput.dataset.traitSearch;
                const list = document.querySelector(`[data-trait-list="${key}"]`);
                if (!list) {
                    return;
                }

                const query = searchInput.value.trim().toLowerCase();

                list.querySelectorAll("[data-trait-item]").forEach((item) => {
                    const name = item.dataset.name || "";
                    const desc = item.dataset.desc || "";
                    const bodyTypeOk = !item.hidden || true;
                    const visible = (!query || name.includes(query) || desc.includes(query)) && bodyTypeOk;
                    item.hidden = !visible;
                });

                applyBodyTypeFilter();
            });
        });

        if (loreTemplateSearch) {
            loreTemplateSearch.addEventListener("input", () => {
                const query = loreTemplateSearch.value.trim().toLowerCase();

                document.querySelectorAll("[data-lore-item]").forEach((item) => {
                    const name = item.dataset.name || "";
                    const desc = item.dataset.desc || "";
                    item.hidden = !!query && !name.includes(query) && !desc.includes(query);
                });
            });
        }
    }

    function createDynamicRow(value = "") {
        const row = document.createElement("div");
        row.className = "dynamic-link-row";

        row.innerHTML = `
            <input
                class="form-input dynamic-link-input"
                type="text"
                name="extra_content"
                placeholder="Ссылка или Workshop ID"
                data-dynamic-link-input
            >
            <button
                type="button"
                class="dynamic-link-remove"
                data-dynamic-link-remove
                aria-label="Удалить строку"
                hidden
            >
                ×
            </button>
        `;

        const input = row.querySelector("[data-dynamic-link-input]");
        if (input) {
            input.value = value;
        }

        return row;
    }

    function syncDynamicLinkRows() {
        if (!dynamicLinksRoot) {
            return;
        }

        let rows = Array.from(dynamicLinksRoot.querySelectorAll(".dynamic-link-row"));

        if (rows.length === 0) {
            dynamicLinksRoot.appendChild(createDynamicRow());
            rows = Array.from(dynamicLinksRoot.querySelectorAll(".dynamic-link-row"));
        }

        const inputs = rows.map((row) => row.querySelector("[data-dynamic-link-input]")).filter(Boolean);
        const hasEmpty = inputs.some((input) => input.value.trim() === "");

        if (!hasEmpty) {
            dynamicLinksRoot.appendChild(createDynamicRow());
        }

        rows = Array.from(dynamicLinksRoot.querySelectorAll(".dynamic-link-row"));

        rows.forEach((row, index) => {
            const input = row.querySelector("[data-dynamic-link-input]");
            const removeBtn = row.querySelector("[data-dynamic-link-remove]");
            if (!input || !removeBtn) {
                return;
            }

            const isLast = index === rows.length - 1;
            removeBtn.hidden = isLast && input.value.trim() === "";
        });

        rows.forEach((row, index) => {
            const input = row.querySelector("[data-dynamic-link-input]");
            if (!input) {
                return;
            }

            const isLast = index === rows.length - 1;
            if (!isLast && input.value.trim() === "") {
                row.remove();
            }
        });
    }

    function initDynamicLinks() {
        if (!dynamicLinksRoot) {
            return;
        }

        dynamicLinksRoot.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) {
                return;
            }

            if (!target.matches("[data-dynamic-link-input]")) {
                return;
            }

            syncDynamicLinkRows();
        });

        dynamicLinksRoot.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            if (!target.matches("[data-dynamic-link-remove]")) {
                return;
            }

            const row = target.closest(".dynamic-link-row");
            if (row) {
                row.remove();
                syncDynamicLinkRows();
            }
        });

        syncDynamicLinkRows();
    }

    function openLoreSlotModal() {
        if (loreSlotModal) {
            loreSlotModal.hidden = false;
        }
    }

    function closeLoreSlotModal() {
        if (loreSlotModal) {
            loreSlotModal.hidden = true;
        }
    }

    function initLoreSlotModal() {
        if (openLoreSlotBtn) {
            openLoreSlotBtn.addEventListener("click", openLoreSlotModal);
        }

        if (closeLoreSlotBtn) {
            closeLoreSlotBtn.addEventListener("click", closeLoreSlotModal);
        }

        if (loreSlotModal) {
            loreSlotModal.addEventListener("click", (event) => {
                if (event.target === loreSlotModal) {
                    closeLoreSlotModal();
                }
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeLoreSlotModal();
            }
        });
    }

    inputs.forEach((input) => {
        input.addEventListener("change", () => updateState());
    });

    requiredNormalFields.forEach((field) => {
        field.addEventListener("input", () => updateState());
        field.addEventListener("change", () => updateState());
    });

    loreTemplateRadios.forEach((radio) => {
        radio.addEventListener("change", () => updateState());
    });

    if (roleTypeSelect) {
        let previousMode = roleTypeSelect.value;

        roleTypeSelect.addEventListener("change", () => {
            const oldMode = previousMode;
            previousMode = roleTypeSelect.value;
            updateState(oldMode);
        });
    }

    if (bodyTypeSelect) {
        bodyTypeSelect.addEventListener("change", () => updateState());
    }

    if (form) {
        form.addEventListener("submit", (event) => {
            updateState();

            if (submitBtn && submitBtn.disabled) {
                event.preventDefault();
            }
        });
    }

    initTabs();
    initSearch();
    initDynamicLinks();
    initLoreSlotModal();
    updateState();
});
