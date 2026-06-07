/**
 * 地域マップモジュール
 *
 * Google My Maps を iframe 埋め込みで表示します。
 * スポット一覧はカテゴリ別にグループ化して表示します。
 *
 * 将来の独自マップ対応: renderMapEmbed() を別コンポーネントへ置き換えるだけで移行できます。
 */

/** Google My Maps を iframe で描画します。 */
export function renderMapEmbed(containerId, mapUrl) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.className = "embed-frame map-frame";
    iframe.src = mapUrl;
    iframe.title = "若松町内会 地域マップ";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";

    container.appendChild(iframe);
}

    function renderLocalImageMap(containerId, imageUrl, spots, fallbackMapUrl) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";

        const wrap = document.createElement("div");
        wrap.className = "local-map-wrap";

        const image = document.createElement("img");
        image.className = "local-map-image";
        image.alt = "若松町周辺の地域マップ";
        image.src = imageUrl;

        const markersLayer = document.createElement("div");
        markersLayer.className = "local-map-markers";

        spots.forEach((spot) => {
            if (typeof spot.x !== "number" || typeof spot.y !== "number") {
                return;
            }
            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "local-map-marker";
            marker.style.left = `${spot.x}%`;
            marker.style.top = `${spot.y}%`;
            marker.title = `${spot.category}: ${spot.name}`;
            marker.textContent = "●";
            markersLayer.appendChild(marker);
        });

        image.addEventListener("error", () => {
            renderMapEmbed(containerId, fallbackMapUrl);
        });

        wrap.append(image, markersLayer);
        container.appendChild(wrap);
    }

/** カテゴリ別スポットをグループ化して表示します。 */
function renderSpotsByCategory(root, spots) {
    root.innerHTML = "";

    // カテゴリ別に分類
    const byCategory = {};
    spots.forEach((spot) => {
        const cat  = typeof spot === "string" ? "その他" : (spot.category || "その他");
        const name = typeof spot === "string" ? spot      : spot.name;
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(name);
    });

    const CATEGORY_ICONS = {
        "集会所":   "🏠",
        "避難所":   "🏫",
        "AED":      "❤️",
        "防災倉庫": "📦",
        "その他":   "📍"
    };

    Object.entries(byCategory).forEach(([category, names]) => {
        const row = document.createElement("div");
        row.className = "spot-category";

        const label = document.createElement("span");
        label.className = "spot-category-label";
        label.textContent = `${CATEGORY_ICONS[category] ?? "📍"} ${category}`;

        row.appendChild(label);

        names.forEach((name) => {
            const pill = document.createElement("span");
            pill.className = "pill-item";
            pill.textContent = name;
            row.appendChild(pill);
        });

        root.appendChild(row);
    });
}

/** 地域マップページを初期化します。 */
export function initMapPage(config) {
    const mapUrl = config?.map?.myMapsUrl || "about:blank";
    const localImageUrl = config?.map?.localImageUrl;
    const spots = config?.map?.spots || [];

    if (localImageUrl) {
        renderLocalImageMap("map-embed", localImageUrl, spots, mapUrl);
    } else {
        renderMapEmbed("map-embed", mapUrl);
    }

    const spotsRoot = document.getElementById("map-spots");
    if (!spotsRoot) return;

    const allSpots = (config?.map?.spots || []).map((spot) => {
        if (typeof spot === "string") {
            return { name: spot, category: "その他" };
        }
        return { name: spot.name || "", category: spot.category || "その他" };
    });

    const categoryFilter = document.getElementById("map-category-filter");
    const searchInput = document.getElementById("map-search");
    const emptyState = document.getElementById("map-empty");

    if (categoryFilter) {
        const categories = Array.from(new Set(allSpots.map((spot) => spot.category)));
        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }

    const applyFilters = () => {
        const selectedCategory = categoryFilter?.value || "all";
        const keyword = (searchInput?.value || "").trim().toLowerCase();

        const filtered = allSpots.filter((spot) => {
            const byCategory = selectedCategory === "all" || spot.category === selectedCategory;
            const byKeyword = keyword === "" || spot.name.toLowerCase().includes(keyword);
            return byCategory && byKeyword;
        });

        renderSpotsByCategory(spotsRoot, filtered);
        if (emptyState) {
            emptyState.classList.toggle("hidden", filtered.length > 0);
        }
    };

    categoryFilter?.addEventListener("change", applyFilters);
    searchInput?.addEventListener("input", applyFilters);
    applyFilters();
}
