document.addEventListener("DOMContentLoaded", () => {
    const nodes = document.querySelectorAll(".js-local-datetime");

    for (const node of nodes) {
        const utcValue = node.dataset.utc;
        const label = node.dataset.label || "";

        if (!utcValue) {
            continue;
        }

        const date = new Date(utcValue);
        if (Number.isNaN(date.getTime())) {
            continue;
        }

        const formatter = new Intl.DateTimeFormat(undefined, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const formatted = formatter.format(date);
        node.textContent = label ? `${label}: ${formatted}` : formatted;
    }
});
