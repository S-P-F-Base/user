document.addEventListener("DOMContentLoaded", () => {
    const PAGE_SIZE = 12;

    const listRoot = document.getElementById("limits-list");
    const searchInput = document.getElementById("limits-search");
    const statusFilter = document.getElementById("limits-status-filter");
    const sortSelect = document.getElementById("limits-sort");
    const emptyState = document.getElementById("limits-empty");
    const pagers = Array.from(document.querySelectorAll("[data-limits-pagination]"));

    function formatUtcToLocal(utcValue) {
        if (!utcValue) {
            return "";
        }

        const date = new Date(utcValue);
        if (Number.isNaN(date.getTime())) {
            return utcValue;
        }

        return new Intl.DateTimeFormat("ru-RU", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }

    document.querySelectorAll(".js-limit-datetime").forEach((node) => {
        const utcValue = node.getAttribute("data-utc") || "";
        const formatted = formatUtcToLocal(utcValue);
        if (formatted) {
            node.textContent = formatted;
        }
    });

    function updateDescriptionToggles() {
        document.querySelectorAll("[data-limit-item]").forEach((cardNode) => {
            if (!(cardNode instanceof HTMLElement)) {
                return;
            }

            const descNode = cardNode.querySelector("[data-limit-desc]");
            const toggleNode = cardNode.querySelector("[data-limit-desc-toggle]");

            if (!(descNode instanceof HTMLElement) || !(toggleNode instanceof HTMLButtonElement)) {
                return;
            }

            if (cardNode.hidden) {
                toggleNode.hidden = true;
                return;
            }

            const expandLabel = toggleNode.getAttribute("data-expand-label") || "Показать описание";
            const collapseLabel = toggleNode.getAttribute("data-collapse-label") || "Скрыть описание";

            if (!toggleNode.dataset.bound) {
                toggleNode.addEventListener("click", () => {
                    const isExpanded = descNode.classList.toggle("is-expanded");
                    toggleNode.textContent = isExpanded ? collapseLabel : expandLabel;
                });
                toggleNode.dataset.bound = "1";
            }

            if (descNode.classList.contains("is-expanded")) {
                toggleNode.hidden = false;
                toggleNode.textContent = collapseLabel;
                return;
            }

            toggleNode.textContent = expandLabel;
            toggleNode.hidden = false;

            const hasOverflow = descNode.scrollHeight > descNode.clientHeight + 1;
            if (!hasOverflow) {
                toggleNode.hidden = true;
            }
        });
    }

    if (!(listRoot instanceof HTMLElement)) {
        return;
    }

    const items = Array.from(listRoot.querySelectorAll("[data-limit-item]")).map((node) => {
        const orderIndex = Number(node.getAttribute("data-order-index") || 0);
        const expiresTs = Number(node.getAttribute("data-expires-ts") || 0);
        const status = node.getAttribute("data-status") || "active";
        const title = (node.getAttribute("data-title") || "").toLowerCase();
        const searchBlob = (node.getAttribute("data-search") || "").toLowerCase();

        return {
            node,
            orderIndex,
            expiresTs,
            status,
            title,
            searchBlob,
        };
    });

    const state = {
        page: 1,
    };

    function compareByExpire(a, b, direction) {
        const aNoExpire = a.expiresTs <= 0;
        const bNoExpire = b.expiresTs <= 0;

        if (aNoExpire !== bNoExpire) {
            return aNoExpire ? 1 : -1;
        }

        if (aNoExpire && bNoExpire) {
            return a.orderIndex - b.orderIndex;
        }

        if (direction === "asc") {
            return a.expiresTs - b.expiresTs || a.orderIndex - b.orderIndex;
        }

        return b.expiresTs - a.expiresTs || a.orderIndex - b.orderIndex;
    }

    function compareBySort(a, b, sort) {
        if (sort === "name_status") {
            const statusPriority = {
                permanent: 0,
                active: 1,
                expired: 2,
                canceled: 3,
                revoked: 4,
            };

            const aStatus = statusPriority[a.status] ?? 99;
            const bStatus = statusPriority[b.status] ?? 99;
            if (aStatus !== bStatus) {
                return aStatus - bStatus;
            }

            const byName = a.title.localeCompare(b.title, "ru", { sensitivity: "base" });
            if (byName !== 0) {
                return byName;
            }

            return a.orderIndex - b.orderIndex;
        }

        if (sort === "expire_asc") {
            return compareByExpire(a, b, "asc") || a.orderIndex - b.orderIndex;
        }

        if (sort === "expire_desc") {
            return compareByExpire(a, b, "desc") || a.orderIndex - b.orderIndex;
        }

        return a.orderIndex - b.orderIndex;
    }

    function buildFilteredSortedItems() {
        const query = (searchInput instanceof HTMLInputElement ? searchInput.value : "")
            .trim()
            .toLowerCase();
        const status = statusFilter instanceof HTMLSelectElement ? statusFilter.value : "all";
        const sort = sortSelect instanceof HTMLSelectElement ? sortSelect.value : "name_status";

        const filtered = items.filter((item) => {
            if (query && !item.searchBlob.includes(query)) {
                return false;
            }

            if (status !== "all" && item.status !== status) {
                return false;
            }

            return true;
        });

        return filtered.sort((a, b) => compareBySort(a, b, sort));
    }

    function setPagerState(totalPages, hasRows) {
        const isFirst = state.page <= 1;
        const isLast = state.page >= totalPages;

        pagers.forEach((pager) => {
            const firstBtn = pager.querySelector('[data-page-action="first"]');
            const prevBtn = pager.querySelector('[data-page-action="prev"]');
            const nextBtn = pager.querySelector('[data-page-action="next"]');
            const lastBtn = pager.querySelector('[data-page-action="last"]');
            const stateNode = pager.querySelector("[data-page-state]");

            pager.hidden = !hasRows;

            if (firstBtn instanceof HTMLButtonElement) {
                firstBtn.disabled = !hasRows || isFirst;
            }
            if (prevBtn instanceof HTMLButtonElement) {
                prevBtn.disabled = !hasRows || isFirst;
            }
            if (nextBtn instanceof HTMLButtonElement) {
                nextBtn.disabled = !hasRows || isLast;
            }
            if (lastBtn instanceof HTMLButtonElement) {
                lastBtn.disabled = !hasRows || isLast;
            }

            if (stateNode instanceof HTMLElement) {
                stateNode.textContent = hasRows
                    ? `Страница ${state.page} из ${totalPages}`
                    : "Страниц: 0";
            }
        });
    }

    function render() {
        const filteredSorted = buildFilteredSortedItems();
        const filteredCount = filteredSorted.length;
        const totalPages = filteredCount > 0 ? Math.ceil(filteredCount / PAGE_SIZE) : 0;

        if (totalPages === 0) {
            state.page = 1;
        } else if (state.page > totalPages) {
            state.page = totalPages;
        }

        const start = filteredCount === 0 ? 0 : (state.page - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, filteredCount);
        const pageItems = filteredSorted.slice(start, end);
        const pageSet = new Set(pageItems);

        items.forEach((item) => {
            item.node.hidden = !pageSet.has(item);
        });

        pageItems.forEach((item) => {
            listRoot.appendChild(item.node);
        });

        if (emptyState instanceof HTMLElement) {
            emptyState.hidden = filteredCount !== 0;
        }

        setPagerState(totalPages, filteredCount > 0);
        updateDescriptionToggles();
    }

    function resetAndRender() {
        state.page = 1;
        render();
    }

    if (searchInput instanceof HTMLInputElement) {
        searchInput.addEventListener("input", resetAndRender);
    }

    if (statusFilter instanceof HTMLSelectElement) {
        statusFilter.addEventListener("change", resetAndRender);
    }

    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.addEventListener("change", resetAndRender);
    }

    pagers.forEach((pager) => {
        pager.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const button = target.closest("[data-page-action]");
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            const action = button.getAttribute("data-page-action");
            if (!action) {
                return;
            }

            if (action === "first") {
                if (state.page === 1) {
                    return;
                }
                state.page = 1;
                render();
                return;
            }

            if (action === "prev") {
                if (state.page <= 1) {
                    return;
                }
                state.page -= 1;
                render();
                return;
            }

            if (action === "next") {
                state.page += 1;
                render();
                return;
            }

            if (action === "last") {
                const filteredSorted = buildFilteredSortedItems();
                const totalPages = filteredSorted.length > 0 ? Math.ceil(filteredSorted.length / PAGE_SIZE) : 1;
                if (state.page === totalPages) {
                    return;
                }
                state.page = totalPages;
                render();
            }
        });
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        if (resizeTimer !== null) {
            clearTimeout(resizeTimer);
        }
        resizeTimer = window.setTimeout(() => {
            updateDescriptionToggles();
        }, 120);
    });

    render();
});
