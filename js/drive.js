/**
 * Google Drive 連携モジュール
 *
 * 将来は Drive API (files.list) でフォルダ内の PDF 一覧を取得します。
 * 現時点は config.js のモックデータを使用します。
 *
 * Drive API 連携時の置き換え先: getDriveCircular() / getDriveDocuments()
 */

/** 回覧板（年別フォルダ）を返します。将来は Drive API へ置き換えます。 */
export async function getDriveCircular(config) {
    // TODO: 実装例
    // const folderId = config.drive.circularFolderId;
    // const res = await gapi.client.drive.files.list({ q: `'${folderId}' in parents`, ... });
    return Promise.resolve(config?.drive?.mockCircular ?? {});
}

/** その他資料を返します。将来は Drive API へ置き換えます。 */
export async function getDriveDocuments(config) {
    return Promise.resolve(config?.drive?.mockDocuments ?? {});
}

/** 年タブを生成します。 */
function createYearTabs(years, activeYear, onSelect) {
    const nav = document.createElement("nav");
    nav.className = "year-tabs";
    nav.setAttribute("aria-label", "年度を選択");

    years.forEach((year) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "year-tab" + (year === activeYear ? " active" : "");
        btn.textContent = year + "年";
        btn.setAttribute("aria-pressed", String(year === activeYear));
        btn.addEventListener("click", () => {
            nav.querySelectorAll(".year-tab").forEach((b) => {
                b.classList.toggle("active", b === btn);
                b.setAttribute("aria-pressed", String(b === btn));
            });
            onSelect(year);
        });
        nav.appendChild(btn);
    });

    return nav;
}

/** PDF 一覧を container に描画します。 */
function renderPdfList(container, items, fallbackUrl) {
    container.innerHTML = "";

    if (!items || items.length === 0) {
        container.innerHTML = "<p class='note'>このフォルダには資料がありません。</p>";
        return;
    }

    const list = document.createElement("ul");
    list.className = "simple-list";

    items.forEach((item) => {
        const li = document.createElement("li");
        li.dataset.docTitle = (item.title || "").toLowerCase();
        const link = document.createElement("a");
        link.href = item.url || fallbackUrl || "#";
        link.textContent = item.title;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        li.appendChild(link);
        if (item.date) {
            const dateSpan = document.createElement("span");
            dateSpan.className = "note";
            dateSpan.textContent = ` (${item.date})`;
            li.appendChild(dateSpan);
        }
        list.appendChild(li);
    });

    container.appendChild(list);
}

/** 回覧板セクション（年タブ付き）を生成します。 */
function buildCircularSection(circular, config) {
    const card = document.createElement("section");
    card.className = "card";
    card.dataset.source = "circular";

    const h2 = document.createElement("h2");
    h2.textContent = "📋 回覧板";
    card.appendChild(h2);

    const years = Object.keys(circular).sort().reverse();
    if (years.length === 0) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "資料は準備中です。";
        card.appendChild(note);
        return card;
    }

    const pdfContainer = document.createElement("div");
    pdfContainer.className = "pdf-list-container";

    const tabNav = createYearTabs(years, years[0], (year) => {
        renderPdfList(pdfContainer, circular[year], config.drive.circularFolderUrl);
    });

    renderPdfList(pdfContainer, circular[years[0]], config.drive.circularFolderUrl);
    card.append(tabNav, pdfContainer);
    return card;
}

/** その他資料セクションを生成します。 */
function buildOtherDocsSection(docs, fallbackUrl) {
    const card = document.createElement("section");
    card.className = "card";
    card.dataset.source = "other";

    const h2 = document.createElement("h2");
    h2.textContent = "📁 その他資料";
    card.appendChild(h2);

    Object.entries(docs).forEach(([category, items]) => {
        const h3 = document.createElement("h3");
        h3.textContent = category;
        h3.style.marginTop = "16px";

        const list = document.createElement("ul");
        list.className = "simple-list";

        items.forEach((item) => {
            const li = document.createElement("li");
            li.dataset.docTitle = (item.title || "").toLowerCase();
            const link = document.createElement("a");
            link.href = item.url || fallbackUrl || "#";
            link.textContent = item.title;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            li.appendChild(link);
            list.appendChild(li);
        });

        card.append(h3, list);
    });

    return card;
}

function bindDocumentsFilters(root) {
    const sourceFilter = document.getElementById("docs-source-filter");
    const searchInput = document.getElementById("docs-search");
    const emptyState = document.getElementById("docs-empty");

    const applyFilters = () => {
        const selectedSource = sourceFilter?.value || "all";
        const keyword = (searchInput?.value || "").trim().toLowerCase();

        let visibleCards = 0;
        let visibleItems = 0;

        root.querySelectorAll(".card[data-source]").forEach((card) => {
            const source = card.dataset.source;
            const bySource = selectedSource === "all" || selectedSource === source;

            if (!bySource) {
                card.classList.add("hidden");
                return;
            }

            let itemCount = 0;
            card.querySelectorAll("li[data-doc-title]").forEach((li) => {
                const match = keyword === "" || (li.dataset.docTitle || "").includes(keyword);
                li.classList.toggle("hidden", !match);
                if (match) {
                    itemCount += 1;
                }
            });

            const visible = itemCount > 0 || card.querySelectorAll("li[data-doc-title]").length === 0;
            card.classList.toggle("hidden", !visible);
            if (visible) {
                visibleCards += 1;
            }
            visibleItems += itemCount;
        });

        if (emptyState) {
            const hasResult = visibleCards > 0 && (keyword === "" || visibleItems > 0);
            emptyState.classList.toggle("hidden", hasResult);
        }
    };

    sourceFilter?.addEventListener("change", applyFilters);
    searchInput?.addEventListener("input", applyFilters);
    applyFilters();
}

/** 資料室ページを初期化します。 */
export async function initDocumentsPage(config) {
    const root = document.getElementById("documents-root");
    if (!root) return;

    const [circular, otherDocs] = await Promise.all([
        getDriveCircular(config),
        getDriveDocuments(config)
    ]);

    root.appendChild(buildCircularSection(circular, config));

    if (Object.keys(otherDocs).length > 0) {
        root.appendChild(buildOtherDocsSection(otherDocs, config.drive.circularFolderUrl));
    }

    bindDocumentsFilters(root);
}
