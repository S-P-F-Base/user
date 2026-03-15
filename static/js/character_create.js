document.addEventListener("DOMContentLoaded", () => {
    const WORKSHOP_DEBOUNCE_MS = 4500;

    const WORKSHOP_HINT_EMPTY = "Начните вводить ссылки или ID. Проверка запускается автоматически.";
    const WORKSHOP_HINT_PENDING = "Проверка формата запущена...";
    const WORKSHOP_HINT_BAD = "Найдены некорректные ссылки или ID.";
    const WORKSHOP_HINT_OK = "Workshop-контент выглядит корректно.";
    const WORKSHOP_HINT_CLEANED = "Некорректные значения были удалены. Проверьте список перед отправкой.";
    const WORKSHOP_ERROR_TEXT = "Разрешены только ссылка Steam Workshop или числовой ID аддона.";
    const DRAFT_STORAGE_KEY = "characters_create_draft_v1";
    const SUCCESS_POPUPS = new Set(["created", "lore_requested"]);

    const form = document.getElementById("char-create-form");
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

    const modelIdField = document.getElementById("model-id");
    const dynamicLinksRoot = document.getElementById("extra-content-list");
    const workshopInlineState = document.getElementById("workshop-inline-state");

    const loreTemplateRadios = Array.from(document.querySelectorAll('input[type="radio"][name="lore_template_id"]'));
    const loreTemplateSearch = document.getElementById("lore-template-search");

    const loreSlotModal = document.getElementById("lore-slot-modal");
    const openLoreSlotBtn = document.getElementById("open-lore-slot-request");
    const closeLoreSlotBtn = document.getElementById("close-lore-slot-modal");

    const workshopHosts = new Set(["steamcommunity.com", "www.steamcommunity.com"]);
    const workshopPaths = new Set(["/sharedfiles/filedetails", "/workshop/filedetails"]);

    const requiredNormalFields = [
        nameField,
        bodyTypeSelect,
        descriptionField,
        backstoryField,
    ].filter(Boolean);

    let workshopCheckTimer = null;

    function setInlineWorkshopState(text, level = "") {
        if (!workshopInlineState) {
            return;
        }

        workshopInlineState.textContent = text;
        workshopInlineState.classList.remove("is-good", "is-bad", "is-info");

        if (level === "good") {
            workshopInlineState.classList.add("is-good");
            return;
        }

        if (level === "bad") {
            workshopInlineState.classList.add("is-bad");
            return;
        }

        workshopInlineState.classList.add("is-info");
    }

    function setFieldVisualState(field, state) {
        if (!field) {
            return;
        }

        field.classList.remove("is-valid", "is-invalid");

        if (state === "valid") {
            field.classList.add("is-valid");
        } else if (state === "invalid") {
            field.classList.add("is-invalid");
        }
    }

    function setRequiredFieldState(field, shouldValidate) {
        if (!(field instanceof HTMLElement)) {
            return;
        }

        if (!shouldValidate) {
            field.classList.remove("is-required-empty");
            return;
        }

        field.classList.toggle("is-required-empty", !isFilled(field));
    }

    function syncRequiredFieldHighlights() {
        const mode = roleTypeSelect ? roleTypeSelect.value : "";

        if (roleTypeSelect instanceof HTMLSelectElement) {
            setRequiredFieldState(roleTypeSelect, true);
        }

        requiredNormalFields.forEach((field) => {
            setRequiredFieldState(field, mode === "norm");
        });
    }

    function getPopupCodeFromUrl() {
        try {
            const url = new URL(window.location.href);
            return url.searchParams.get("popup") || "";
        } catch {
            return "";
        }
    }

    function clearCharacterDraft() {
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
            // Ignore storage errors.
        }
    }

    function getActiveTraitTab() {
        const activeTab = document.querySelector('[data-tab-root="traits"] [data-tab-open].active');
        if (!(activeTab instanceof HTMLElement)) {
            return "";
        }

        return activeTab.dataset.tabOpen || "";
    }

    function setActiveTraitTab(tabKey) {
        if (!tabKey) {
            return;
        }

        const root = document.querySelector('[data-tab-root="traits"]');
        if (!(root instanceof HTMLElement)) {
            return;
        }

        const targetButton = root.querySelector(`[data-tab-open="${tabKey}"]`);
        const targetPane = root.querySelector(`[data-tab-pane="${tabKey}"]`);
        if (!(targetButton instanceof HTMLElement) || !(targetPane instanceof HTMLElement)) {
            return;
        }

        root.querySelectorAll("[data-tab-open]").forEach((button) => {
            button.classList.remove("active");
        });
        root.querySelectorAll("[data-tab-pane]").forEach((pane) => {
            pane.classList.remove("active");
        });

        targetButton.classList.add("active");
        targetPane.classList.add("active");
    }

    function buildCharacterDraft() {
        const roleType = roleTypeSelect instanceof HTMLSelectElement ? roleTypeSelect.value : "";
        const bodyType = bodyTypeSelect instanceof HTMLSelectElement ? bodyTypeSelect.value : "";

        const checkedTraitIds = getTraitInputs()
            .filter((input) => input.checked)
            .map((input) => input.value);

        const traitSearches = {};
        document.querySelectorAll("[data-trait-search]").forEach((input) => {
            if (!(input instanceof HTMLInputElement)) {
                return;
            }

            const key = input.dataset.traitSearch || "";
            const value = input.value.trim();
            if (key && value) {
                traitSearches[key] = value;
            }
        });

        const extraContent = getDynamicLinkInputs()
            .map((input) => input.value.trim())
            .filter((value) => value !== "");

        return {
            roleType,
            name: nameField instanceof HTMLInputElement ? nameField.value : "",
            bodyType,
            description: descriptionField instanceof HTMLTextAreaElement ? descriptionField.value : "",
            backstory: backstoryField instanceof HTMLTextAreaElement ? backstoryField.value : "",
            modelId: modelIdField instanceof HTMLInputElement ? modelIdField.value : "",
            extraContent,
            checkedTraitIds,
            activeTraitTab: getActiveTraitTab(),
            traitSearches,
            loreTemplateId: getSelectedLoreTemplate(),
            loreSearch: loreTemplateSearch instanceof HTMLInputElement ? loreTemplateSearch.value : "",
        };
    }

    function saveCharacterDraft() {
        const draft = buildCharacterDraft();
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        } catch {
            // Ignore storage errors.
        }
    }

    function restoreCharacterDraft() {
        let rawDraft = "";
        try {
            rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY) || "";
        } catch {
            return;
        }

        if (!rawDraft) {
            return;
        }

        let draft;
        try {
            draft = JSON.parse(rawDraft);
        } catch {
            return;
        }

        if (!draft || typeof draft !== "object") {
            return;
        }

        if (roleTypeSelect instanceof HTMLSelectElement && typeof draft.roleType === "string") {
            roleTypeSelect.value = draft.roleType;
        }

        if (nameField instanceof HTMLInputElement && typeof draft.name === "string") {
            nameField.value = draft.name;
        }

        if (bodyTypeSelect instanceof HTMLSelectElement && typeof draft.bodyType === "string") {
            if (draft.bodyType === "bio" || draft.bodyType === "synthetic") {
                bodyTypeSelect.value = draft.bodyType;
            }
        }

        if (descriptionField instanceof HTMLTextAreaElement && typeof draft.description === "string") {
            descriptionField.value = draft.description;
            autoResizeTextarea(descriptionField);
        }

        if (backstoryField instanceof HTMLTextAreaElement && typeof draft.backstory === "string") {
            backstoryField.value = draft.backstory;
            autoResizeTextarea(backstoryField);
        }

        if (modelIdField instanceof HTMLInputElement && typeof draft.modelId === "string") {
            modelIdField.value = draft.modelId;
        }

        if (Array.isArray(draft.extraContent)) {
            const values = draft.extraContent
                .map((value) => String(value).trim())
                .filter((value) => value !== "");
            rebuildDynamicRowsFromValues(values);
        }

        const selectedTraits = new Set(
            Array.isArray(draft.checkedTraitIds) ? draft.checkedTraitIds.map((value) => String(value)) : []
        );
        getTraitInputs().forEach((input) => {
            input.checked = selectedTraits.has(String(input.value));
        });

        if (typeof draft.activeTraitTab === "string") {
            setActiveTraitTab(draft.activeTraitTab);
        }

        if (draft.traitSearches && typeof draft.traitSearches === "object") {
            document.querySelectorAll("[data-trait-search]").forEach((input) => {
                if (!(input instanceof HTMLInputElement)) {
                    return;
                }

                const key = input.dataset.traitSearch || "";
                const value = key ? draft.traitSearches[key] : "";
                input.value = typeof value === "string" ? value : "";
            });
        }

        if (typeof draft.loreSearch === "string" && loreTemplateSearch instanceof HTMLInputElement) {
            loreTemplateSearch.value = draft.loreSearch;
        }

        if (typeof draft.loreTemplateId === "string") {
            loreTemplateRadios.forEach((radio) => {
                radio.checked = radio.value === draft.loreTemplateId;
            });
        }
    }

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

    function extractWorkshopId(rawValue) {
        const value = String(rawValue || "").trim();
        if (!value) {
            return null;
        }

        if (/^\d+$/.test(value)) {
            return value;
        }

        let candidate = value;
        if (/^(steamcommunity\.com|www\.steamcommunity\.com)\//i.test(candidate)) {
            candidate = `https://${candidate}`;
        }

        let parsed;
        try {
            parsed = new URL(candidate);
        } catch {
            return null;
        }

        if (!workshopHosts.has(parsed.hostname.toLowerCase())) {
            return null;
        }

        const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
        if (!workshopPaths.has(path)) {
            return null;
        }

        const id = parsed.searchParams.get("id") || "";
        if (!/^\d+$/.test(id)) {
            return null;
        }

        return id;
    }

    function createDynamicRow(value = "") {
        const row = document.createElement("div");
        row.className = "dynamic-link-row";

        row.innerHTML = `
            <input
                class="form-input dynamic-link-input"
                type="text"
                name="extra_content"
                placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=... или ID"
                data-dynamic-link-input
            >
            <button
                type="button"
                class="dynamic-link-remove"
                data-dynamic-link-remove
                aria-label="Удалить строку"
            >
                x
            </button>
        `;

        const input = row.querySelector("[data-dynamic-link-input]");
        if (input instanceof HTMLInputElement) {
            input.value = value;
        }

        return row;
    }

    function getDynamicLinkRows() {
        if (!dynamicLinksRoot) {
            return [];
        }

        return Array.from(dynamicLinksRoot.querySelectorAll(".dynamic-link-row"));
    }

    function getDynamicLinkInputs() {
        if (!dynamicLinksRoot) {
            return [];
        }

        return Array.from(dynamicLinksRoot.querySelectorAll("[data-dynamic-link-input]"));
    }

    function rebuildDynamicRowsFromValues(values) {
        if (!dynamicLinksRoot) {
            return;
        }

        dynamicLinksRoot.innerHTML = "";

        values.forEach((value) => {
            dynamicLinksRoot.appendChild(createDynamicRow(value));
        });

        dynamicLinksRoot.appendChild(createDynamicRow());
        syncDynamicLinkRows();
    }

    function syncDynamicLinkRows(options = {}) {
        if (!dynamicLinksRoot) {
            return;
        }

        const addTrailing = options.addTrailing === true;

        if (getDynamicLinkRows().length === 0) {
            dynamicLinksRoot.appendChild(createDynamicRow());
        }

        if (addTrailing) {
            const inputs = getDynamicLinkInputs();
            const lastInput = inputs[inputs.length - 1];
            if (lastInput && lastInput.value.trim() !== "") {
                dynamicLinksRoot.appendChild(createDynamicRow());
            }
        }

        const rows = getDynamicLinkRows();
        rows.forEach((row) => {
            const removeBtn = row.querySelector("[data-dynamic-link-remove]");
            if (removeBtn instanceof HTMLElement) {
                removeBtn.hidden = rows.length === 1;
            }
        });
    }

    function getWorkshopRows() {
        const rows = [];

        if (modelIdField instanceof HTMLInputElement) {
            rows.push({
                field: modelIdField,
                label: "Модель",
                allowAutoClean: true,
            });
        }

        getDynamicLinkInputs().forEach((field, index) => {
            rows.push({
                field,
                label: `Контент #${index + 1}`,
                allowAutoClean: true,
            });
        });

        return rows;
    }

    function clearWorkshopFieldState() {
        getWorkshopRows().forEach((row) => {
            row.field.setCustomValidity("");
            setFieldVisualState(row.field, "");
        });
    }

    function renderDraftWorkshopState() {
        const rows = getWorkshopRows();
        let filledCount = 0;
        let invalidCount = 0;

        rows.forEach((row) => {
            const raw = row.field.value.trim();
            row.field.setCustomValidity("");

            if (!raw) {
                setFieldVisualState(row.field, "");
                return;
            }

            filledCount += 1;

            if (extractWorkshopId(raw)) {
                setFieldVisualState(row.field, "valid");
                return;
            }

            invalidCount += 1;
            row.field.setCustomValidity(WORKSHOP_ERROR_TEXT);
            setFieldVisualState(row.field, "invalid");
        });

        if (filledCount === 0) {
            setInlineWorkshopState(WORKSHOP_HINT_EMPTY, "info");
            return;
        }

        if (invalidCount > 0) {
            setInlineWorkshopState(WORKSHOP_HINT_BAD, "bad");
            return;
        }

        setInlineWorkshopState(WORKSHOP_HINT_PENDING, "info");
    }

    function normalizeWorkshopFields(options = {}) {
        const rewrite = options.rewrite === true;
        const clearInvalid = options.clearInvalid === true;
        const dedupe = options.dedupe === true;

        const seen = new Set();

        let valid = true;
        let hadCleanedValues = false;
        let firstInvalid = null;

        getWorkshopRows().forEach((row) => {
            const field = row.field;
            const raw = field.value.trim();
            field.setCustomValidity("");

            if (!raw) {
                setFieldVisualState(field, "");
                return;
            }

            const workshopId = extractWorkshopId(raw);
            if (!workshopId) {
                valid = false;
                field.setCustomValidity(WORKSHOP_ERROR_TEXT);
                setFieldVisualState(field, "invalid");

                if (!firstInvalid) {
                    firstInvalid = field;
                }

                if (clearInvalid && row.allowAutoClean) {
                    field.value = "";
                    setFieldVisualState(field, "");
                    hadCleanedValues = true;
                }

                return;
            }

            if (dedupe && seen.has(workshopId)) {
                if (rewrite) {
                    field.value = "";
                    setFieldVisualState(field, "");
                    hadCleanedValues = true;
                }
                return;
            }

            seen.add(workshopId);

            if (rewrite) {
                field.value = workshopId;
            }

            setFieldVisualState(field, "valid");
        });

        if (rewrite && dynamicLinksRoot) {
            const values = getDynamicLinkInputs()
                .map((input) => input.value.trim())
                .filter((value) => value !== "");

            rebuildDynamicRowsFromValues(values);
        }

        return {
            valid,
            hadCleanedValues,
            firstInvalid,
        };
    }

    function finalizeWorkshopCheck() {
        const result = normalizeWorkshopFields({
            rewrite: true,
            clearInvalid: true,
            dedupe: true,
        });

        if (result.hadCleanedValues) {
            setInlineWorkshopState(WORKSHOP_HINT_CLEANED, "bad");
        } else if (!result.valid) {
            setInlineWorkshopState(WORKSHOP_HINT_BAD, "bad");
        } else {
            const hasAnyWorkshopValue = getWorkshopRows().some((row) => row.field.value.trim() !== "");
            if (hasAnyWorkshopValue) {
                setInlineWorkshopState(WORKSHOP_HINT_OK, "good");
            } else {
                setInlineWorkshopState(WORKSHOP_HINT_EMPTY, "info");
            }
        }

        updateState();
        saveCharacterDraft();
        return result;
    }

    function scheduleWorkshopCheck() {
        if (workshopCheckTimer !== null) {
            clearTimeout(workshopCheckTimer);
        }

        workshopCheckTimer = window.setTimeout(() => {
            workshopCheckTimer = null;
            finalizeWorkshopCheck();
        }, WORKSHOP_DEBOUNCE_MS);
    }

    function closeLoreSlotModal() {
        if (loreSlotModal) {
            loreSlotModal.hidden = true;
        }
    }

    function clearNormalModeData() {
        requiredNormalFields.forEach((field) => {
            if ("value" in field) {
                field.value = "";
            }
        });

        if (bodyTypeSelect instanceof HTMLSelectElement) {
            bodyTypeSelect.value = "bio";
        }

        if (modelIdField instanceof HTMLInputElement) {
            modelIdField.value = "";
        }

        document.querySelectorAll('#normal-character-sections input[type="checkbox"]').forEach((input) => {
            input.checked = false;
        });

        if (dynamicLinksRoot) {
            dynamicLinksRoot.innerHTML = "";
            dynamicLinksRoot.appendChild(createDynamicRow());
            syncDynamicLinkRows();
        }

        if (workshopCheckTimer !== null) {
            clearTimeout(workshopCheckTimer);
            workshopCheckTimer = null;
        }

        clearWorkshopFieldState();
        setInlineWorkshopState(WORKSHOP_HINT_EMPTY, "info");
    }

    function clearLoreModeData() {
        loreTemplateRadios.forEach((radio) => {
            radio.checked = false;
        });

        if (loreTemplateSearch instanceof HTMLInputElement) {
            loreTemplateSearch.value = "";
        }

        document.querySelectorAll("[data-lore-item]").forEach((item) => {
            item.hidden = false;
        });
    }

    function syncCharacterMode(previousMode = "") {
        if (!roleTypeSelect || !normalSections || !loreSections || !loreSlotInlineWrap) {
            return;
        }

        const mode = roleTypeSelect.value;
        const isNormal = mode === "norm";
        const isLore = mode === "lore";

        normalSections.hidden = !isNormal;
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

        if (nameField instanceof HTMLInputElement) {
            nameField.required = isNormal;
        }

        if (bodyTypeSelect instanceof HTMLSelectElement) {
            bodyTypeSelect.required = isNormal;
        }

        if (descriptionField instanceof HTMLTextAreaElement) {
            descriptionField.required = isNormal;
        }

        if (backstoryField instanceof HTMLTextAreaElement) {
            backstoryField.required = isNormal;
        }
    }

    function matchBodyType(itemBodyType, selectedBodyType) {
        if (!selectedBodyType) {
            return true;
        }

        const normalized = String(itemBodyType || "any").toLowerCase();
        if (normalized === "any") {
            return true;
        }

        if (selectedBodyType === "bio") {
            return normalized === "yes" || normalized === "true";
        }

        if (selectedBodyType === "synthetic") {
            return normalized === "no" || normalized === "false";
        }

        return true;
    }

    function applyTraitFilters() {
        const selectedBodyType = bodyTypeSelect ? bodyTypeSelect.value : "";

        document.querySelectorAll("[data-trait-list]").forEach((list) => {
            const key = list.dataset.traitList || "";
            const searchInput = document.querySelector(`[data-trait-search="${key}"]`);
            const query = (searchInput instanceof HTMLInputElement ? searchInput.value : "").trim().toLowerCase();

            list.querySelectorAll("[data-trait-item]").forEach((item) => {
                const name = item.dataset.name || "";
                const desc = item.dataset.desc || "";
                const bodyTypeOk = matchBodyType(item.dataset.isBio || "any", selectedBodyType);
                const searchOk = !query || name.includes(query) || desc.includes(query);

                item.hidden = !(bodyTypeOk && searchOk);

                if (!bodyTypeOk) {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    if (checkbox instanceof HTMLInputElement) {
                        checkbox.checked = false;
                    }
                }
            });
        });
    }

    function getTraitInputs() {
        return Array.from(document.querySelectorAll('input[type="checkbox"][data-pool][data-effect][data-cost]'));
    }

    function getPools() {
        let mech = 0;
        let rp = 0;

        getTraitInputs().forEach((input) => {
            if (!input.checked) {
                return;
            }

            const cost = Number(input.dataset.cost || 0);
            const delta = input.dataset.effect === "plus" ? cost : -cost;

            if (input.dataset.pool === "mech") {
                mech += delta;
            } else if (input.dataset.pool === "rp") {
                rp += delta;
            }
        });

        return { mech, rp };
    }

    function renderPool(poolName, value) {
        const values = document.querySelectorAll(`[data-pool-value="${poolName}"]`);
        const cards = document.querySelectorAll(`[data-pool-card="${poolName}"]`);

        let state = "is-neutral";
        if (value > 0) {
            state = "is-good";
        } else if (value < 0) {
            state = "is-bad";
        }

        values.forEach((node) => {
            node.textContent = value > 0 ? `+${value}` : `${value}`;
            node.classList.remove("is-good", "is-bad", "is-neutral");
            node.classList.add(state);
        });

        cards.forEach((node) => {
            node.classList.remove("is-good", "is-bad", "is-neutral");
            node.classList.add(state);
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

        const workshopState = normalizeWorkshopFields({
            rewrite: false,
            clearInvalid: false,
            dedupe: false,
        });

        if (!workshopState.valid) {
            return {
                valid: false,
                text: "Проверьте ссылки или ID в дополнительном контенте.",
                cls: "is-bad",
            };
        }

        if (mech < 0 && rp < 0) {
            return {
                valid: false,
                text: "Механический и РП пулы ушли в минус.",
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

    function updateState(previousMode = "") {
        syncCharacterMode(previousMode);
        syncRequiredFieldHighlights();
        applyTraitFilters();

        const mode = roleTypeSelect ? roleTypeSelect.value : "";

        if (mode === "norm") {
            const pools = getPools();
            renderPool("mech", pools.mech);
            renderPool("rp", pools.rp);

            const state = validateNormal(pools.mech, pools.rp);
            if (submitBtn instanceof HTMLButtonElement) {
                submitBtn.disabled = !state.valid;
            }

            if (submitState instanceof HTMLElement) {
                submitState.classList.remove("is-good", "is-bad");
                submitState.textContent = state.text;
                submitState.classList.add(state.cls);
            }

            return;
        }

        if (mode === "lore") {
            const state = validateLore();
            if (submitBtn instanceof HTMLButtonElement) {
                submitBtn.disabled = !state.valid;
            }

            if (submitState instanceof HTMLElement) {
                submitState.classList.remove("is-good", "is-bad");
                submitState.textContent = state.text;
                submitState.classList.add(state.cls);
            }

            return;
        }

        if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = true;
        }

        if (submitState instanceof HTMLElement) {
            submitState.classList.remove("is-good", "is-bad");
            submitState.textContent = "Выберите тип персонажа.";
            submitState.classList.add("is-bad");
        }
    }

    function initTabs() {
        document.querySelectorAll("[data-tab-root]").forEach((root) => {
            const buttons = Array.from(root.querySelectorAll("[data-tab-open]"));
            const panes = Array.from(root.querySelectorAll("[data-tab-pane]"));

            buttons.forEach((button) => {
                button.addEventListener("click", () => {
                    const target = button.dataset.tabOpen;
                    if (!target) {
                        return;
                    }

                    buttons.forEach((item) => item.classList.remove("active"));
                    panes.forEach((pane) => pane.classList.remove("active"));

                    button.classList.add("active");

                    const pane = panes.find((item) => item.dataset.tabPane === target);
                    if (pane) {
                        pane.classList.add("active");
                    }

                    saveCharacterDraft();
                });
            });
        });
    }

    function initSearch() {
        document.querySelectorAll("[data-trait-search]").forEach((input) => {
            input.addEventListener("input", () => {
                applyTraitFilters();
                saveCharacterDraft();
            });
        });

        if (loreTemplateSearch instanceof HTMLInputElement) {
            loreTemplateSearch.addEventListener("input", () => {
                const query = loreTemplateSearch.value.trim().toLowerCase();

                document.querySelectorAll("[data-lore-item]").forEach((item) => {
                    const name = item.dataset.name || "";
                    const desc = item.dataset.desc || "";
                    item.hidden = !!query && !name.includes(query) && !desc.includes(query);
                });

                saveCharacterDraft();
            });
        }
    }

    function initDynamicLinks() {
        if (!dynamicLinksRoot) {
            return;
        }

        dynamicLinksRoot.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || !target.matches("[data-dynamic-link-input]")) {
                return;
            }

            target.setCustomValidity("");
            syncDynamicLinkRows({ addTrailing: true });
            renderDraftWorkshopState();
            scheduleWorkshopCheck();
            updateState();
            saveCharacterDraft();
        });

        dynamicLinksRoot.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !target.matches("[data-dynamic-link-remove]")) {
                return;
            }

            const row = target.closest(".dynamic-link-row");
            if (!row) {
                return;
            }

            const rows = getDynamicLinkRows();
            if (rows.length > 1) {
                row.remove();
            } else {
                const input = row.querySelector("[data-dynamic-link-input]");
                if (input instanceof HTMLInputElement) {
                    input.value = "";
                }
            }

            syncDynamicLinkRows();
            renderDraftWorkshopState();
            scheduleWorkshopCheck();
            updateState();
            saveCharacterDraft();
        });

        syncDynamicLinkRows();
    }

    function initLoreSlotModal() {
        if (openLoreSlotBtn instanceof HTMLButtonElement) {
            openLoreSlotBtn.addEventListener("click", () => {
                if (loreSlotModal) {
                    loreSlotModal.hidden = false;
                }
            });
        }

        if (closeLoreSlotBtn instanceof HTMLButtonElement) {
            closeLoreSlotBtn.addEventListener("click", () => {
                closeLoreSlotModal();
            });
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

    function autoResizeTextarea(textarea) {
        if (!(textarea instanceof HTMLTextAreaElement)) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    function initTextareaAutosize() {
        [descriptionField, backstoryField].forEach((field) => {
            if (!(field instanceof HTMLTextAreaElement)) {
                return;
            }

            autoResizeTextarea(field);
            field.addEventListener("input", () => {
                autoResizeTextarea(field);
            });
        });
    }

    function reportInvalidField(field) {
        if (!field || typeof field.reportValidity !== "function") {
            return;
        }

        field.reportValidity();
    }

    document
        .querySelectorAll('input[type="checkbox"][data-pool][data-effect][data-cost]')
        .forEach((input) => {
            input.addEventListener("change", () => {
                updateState();
                saveCharacterDraft();
            });
        });

    requiredNormalFields.forEach((field) => {
        field.addEventListener("input", () => {
            updateState();
            saveCharacterDraft();
        });
        field.addEventListener("change", () => {
            updateState();
            saveCharacterDraft();
        });
    });

    if (modelIdField instanceof HTMLInputElement) {
        modelIdField.addEventListener("input", () => {
            modelIdField.setCustomValidity("");
            renderDraftWorkshopState();
            scheduleWorkshopCheck();
            updateState();
            saveCharacterDraft();
        });

        modelIdField.addEventListener("change", () => {
            renderDraftWorkshopState();
            scheduleWorkshopCheck();
            updateState();
            saveCharacterDraft();
        });
    }

    loreTemplateRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
            updateState();
            saveCharacterDraft();
        });
    });

    if (roleTypeSelect instanceof HTMLSelectElement) {
        let previousMode = roleTypeSelect.value;
        roleTypeSelect.addEventListener("change", () => {
            const oldMode = previousMode;
            previousMode = roleTypeSelect.value;
            updateState(oldMode);
            saveCharacterDraft();
        });
    }

    if (bodyTypeSelect instanceof HTMLSelectElement) {
        bodyTypeSelect.addEventListener("change", () => {
            updateState();
            saveCharacterDraft();
        });
    }

    if (form) {
        form.addEventListener("submit", (event) => {
            if (workshopCheckTimer !== null) {
                clearTimeout(workshopCheckTimer);
                workshopCheckTimer = null;
            }

            const workshopResult = finalizeWorkshopCheck();

            if (!workshopResult.valid) {
                event.preventDefault();
                reportInvalidField(workshopResult.firstInvalid);
                return;
            }

            if (submitBtn instanceof HTMLButtonElement && submitBtn.disabled) {
                event.preventDefault();
            }
        });
    }

    initTabs();
    initSearch();
    initDynamicLinks();
    initLoreSlotModal();
    initTextareaAutosize();

    const popupCode = getPopupCodeFromUrl();
    if (SUCCESS_POPUPS.has(popupCode)) {
        clearCharacterDraft();
    } else {
        restoreCharacterDraft();
    }

    renderDraftWorkshopState();
    updateState();
});
