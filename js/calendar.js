/**
 * Google Calendar 埋め込みモジュール
 *
 * メインカレンダー（単一 iframe）とカテゴリ別カレンダーカードの両方に対応します。
 * mainUrl が config に設定されている場合はメインカレンダーを優先表示します。
 */

/** メインカレンダー用の iframe を生成します。 */
function createMainEmbed(url) {
    const iframe = document.createElement("iframe");
    iframe.className = "embed-frame calendar-main-embed";
    iframe.src = url;
    iframe.title = "若松町内会 行事カレンダー";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    return iframe;
}

/** カテゴリ別カレンダーカードを生成します（サブ表示用）。 */
export function createCalendarEmbed(title, url) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.title = title;

    const heading = document.createElement("h2");
    heading.textContent = title;

    const iframe = document.createElement("iframe");
    iframe.className = "embed-frame";
    iframe.src = url;
    iframe.title = `${title}カレンダー`;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";

    card.append(heading, iframe);
    return card;
}

/** イベントページのカレンダーを初期化します。 */
export function initCalendarPage(config) {
    // メインカレンダー（1枚埋め込み）
    const mainContainer = document.getElementById("calendar-main");
    if (mainContainer && config?.calendar?.mainUrl) {
        mainContainer.appendChild(createMainEmbed(config.calendar.mainUrl));
    }

    // カテゴリ別カレンダー（グリッド）
    const gridContainer = document.getElementById("calendar-grid");
    if (!gridContainer || !config?.calendar?.embeds) return;

    const categoryFilter = document.getElementById("event-category-filter");
    const searchInput = document.getElementById("event-search");
    const emptyState = document.getElementById("event-empty");

    if (categoryFilter) {
        config.calendar.embeds.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.title;
            option.textContent = item.title;
            categoryFilter.appendChild(option);
        });
    }

    const cards = config.calendar.embeds.map((item) => {
        const card = createCalendarEmbed(item.title, item.url);
        gridContainer.appendChild(card);
        return card;
    });

    const applyFilters = () => {
        const selectedCategory = categoryFilter?.value || "all";
        const keyword = (searchInput?.value || "").trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const title = (card.dataset.title || "").toLowerCase();
            const byCategory = selectedCategory === "all" || card.dataset.title === selectedCategory;
            const byKeyword = keyword === "" || title.includes(keyword);
            const visible = byCategory && byKeyword;
            card.classList.toggle("hidden", !visible);
            if (visible) {
                visibleCount += 1;
            }
        });

        if (emptyState) {
            emptyState.classList.toggle("hidden", visibleCount > 0);
        }
    };

    categoryFilter?.addEventListener("change", applyFilters);
    searchInput?.addEventListener("input", applyFilters);
    applyFilters();
}
