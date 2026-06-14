const OPINION_STORE_KEY = "wakamatsu_opinion_exchange_v1";

const DEFAULT_OPINIONS = [
    {
        id: "OP-1001",
        name: "",
        category: "清掃・ごみ",
        content: "○○の側溝にごみが放置されています。雨の前に確認できると助かります。",
        answered: false,
        status: "検討中",
        reason: "現地確認を予定しています。",
        createdAt: "2026-06-10T09:00:00.000Z",
        updatedAt: "2026-06-10T09:00:00.000Z"
    },
    {
        id: "OP-1002",
        name: "",
        category: "落とし物・探し物",
        content: "自治会館付近で鍵を探しています。お心当たりがあればご連絡ください。",
        answered: true,
        status: "対応中",
        reason: "掲示板にも案内を出しています。",
        createdAt: "2026-06-11T12:30:00.000Z",
        updatedAt: "2026-06-11T12:30:00.000Z"
    }
];

function loadLocalOpinions() {
    const saved = localStorage.getItem(OPINION_STORE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            localStorage.removeItem(OPINION_STORE_KEY);
        }
    }

    localStorage.setItem(OPINION_STORE_KEY, JSON.stringify(DEFAULT_OPINIONS));
    return [...DEFAULT_OPINIONS];
}

function saveLocalOpinions(opinions) {
    localStorage.setItem(OPINION_STORE_KEY, JSON.stringify(opinions));
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getOpinionStatusText(opinion) {
    const status = opinion?.status || "検討中";
    if ((status === "対応中" || status === "保留") && opinion?.reason) {
        return `${status} - ${opinion.reason}`;
    }
    return status;
}

function renderOpinionEntries(listEl, opinions) {
    if (!listEl) {
        return;
    }

    const recent = [...opinions]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 6);

    if (recent.length === 0) {
        listEl.innerHTML = "<p class=\"note\">まだ投稿はありません。</p>";
        return;
    }

    listEl.innerHTML = "";
    recent.forEach((opinion) => {
        const card = document.createElement("article");
        card.className = "card opinion-entry-card";
        card.innerHTML = `
            <div class="opinion-entry-meta">
                <span class="status-badge" data-status="${escapeHtml(opinion.status || "検討中")}">${escapeHtml(opinion.status || "検討中")}</span>
                <span class="note">${escapeHtml(opinion.category || "未分類")}</span>
                <span class="note">${formatDate(opinion.updatedAt || opinion.createdAt)}</span>
            </div>
            <h3>${escapeHtml(opinion.content)}</h3>
            <p><strong>名前:</strong> ${escapeHtml(opinion.name || "匿名")}</p>
            <p><strong>回答の有無:</strong> ${opinion.answered ? "あり" : "なし"}</p>
            <p><strong>管理者の返答:</strong> ${escapeHtml(getOpinionStatusText(opinion))}</p>
        `;
        listEl.appendChild(card);
    });
}

function createOpinionRecord(form) {
    const fd = new FormData(form);
    return {
        id: `OP-${Date.now()}`,
        name: String(fd.get("name") || "").trim(),
        category: String(fd.get("category") || "").trim(),
        content: String(fd.get("content") || "").trim(),
        answered: fd.get("answered") === "on",
        status: "検討中",
        reason: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export function initOpinionExchangePage() {
    const form = document.getElementById("opinion-form");
    const list = document.getElementById("opinion-entry-list");
    const status = document.getElementById("opinion-status");

    if (!form || !list) {
        return;
    }

    const opinions = loadLocalOpinions();
    renderOpinionEntries(list, opinions);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const record = createOpinionRecord(form);

        if (!record.category || !record.content) {
            if (status) {
                status.textContent = "情報と内容を入力してください。";
            }
            return;
        }

        const nextOpinions = [record, ...loadLocalOpinions()];
        saveLocalOpinions(nextOpinions);
        renderOpinionEntries(list, nextOpinions);
        form.reset();

        if (status) {
            status.textContent = "投稿を受け付けました。管理者が確認します。";
        }
    });
}

function renderAdminOpinionCards(root, opinions) {
    if (!root) {
        return;
    }

    if (opinions.length === 0) {
        root.innerHTML = "<p class=\"note\">管理対象の投稿はありません。</p>";
        return;
    }

    root.innerHTML = "";
    opinions.forEach((opinion) => {
        const card = document.createElement("article");
        card.className = "card opinion-admin-card";
        card.dataset.opinionId = opinion.id;
        card.innerHTML = `
            <div class="opinion-admin-meta">
                <span class="status-badge" data-status="${escapeHtml(opinion.status || "検討中")}">${escapeHtml(opinion.status || "検討中")}</span>
                <span class="note">${escapeHtml(opinion.category || "未分類")}</span>
                <span class="note">${formatDate(opinion.updatedAt || opinion.createdAt)}</span>
            </div>
            <h3>${escapeHtml(opinion.content)}</h3>
            <p><strong>名前:</strong> ${escapeHtml(opinion.name || "匿名")}</p>
            <p><strong>回答の有無:</strong> ${opinion.answered ? "あり" : "なし"}</p>
            <form class="opinion-admin-form">
                <label>確認と返答
                    <select name="status">
                        <option value="検討中">検討中</option>
                        <option value="対応中">対応中</option>
                        <option value="保留">保留</option>
                    </select>
                </label>
                <label class="opinion-reason-field">
                    事由
                    <textarea name="reason" placeholder="対応中・保留の理由を入力"></textarea>
                </label>
                <label class="checkbox-line">
                    <input name="answered" type="checkbox">
                    回答の有無
                </label>
                <div class="opinion-admin-actions">
                    <button class="button" type="submit">保存</button>
                </div>
                <p class="note" data-role="admin-status"></p>
            </form>
        `;

        const form = card.querySelector("form");
        const select = card.querySelector('select[name="status"]');
        const reasonField = card.querySelector(".opinion-reason-field");
        const reasonInput = card.querySelector('textarea[name="reason"]');
        const answeredInput = card.querySelector('input[name="answered"]');
        const adminStatus = card.querySelector('[data-role="admin-status"]');

        if (select instanceof HTMLSelectElement) {
            select.value = opinion.status || "検討中";
        }
        if (reasonInput instanceof HTMLTextAreaElement) {
            reasonInput.value = opinion.reason || "";
        }
        if (answeredInput instanceof HTMLInputElement) {
            answeredInput.checked = Boolean(opinion.answered);
        }

        const updateReasonVisibility = () => {
            const shouldShow = select instanceof HTMLSelectElement && (select.value === "対応中" || select.value === "保留");
            reasonField?.classList.toggle("visible", shouldShow);
            if (reasonInput instanceof HTMLTextAreaElement) {
                reasonInput.required = shouldShow;
            }
        };

        updateReasonVisibility();

        select?.addEventListener("change", updateReasonVisibility);

        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const currentOpinions = loadLocalOpinions();
            const index = currentOpinions.findIndex((item) => item.id === opinion.id);
            if (index === -1) {
                if (adminStatus) {
                    adminStatus.textContent = "対象の投稿が見つかりません。";
                }
                return;
            }

            const nextStatus = String(select?.value || "検討中");
            const nextReason = String(reasonInput?.value || "").trim();
            if ((nextStatus === "対応中" || nextStatus === "保留") && !nextReason) {
                if (adminStatus) {
                    adminStatus.textContent = "対応中・保留には事由を入力してください。";
                }
                return;
            }

            currentOpinions[index] = {
                ...currentOpinions[index],
                status: nextStatus,
                reason: nextStatus === "検討中" ? "" : nextReason,
                answered: Boolean(answeredInput?.checked),
                updatedAt: new Date().toISOString()
            };

            saveLocalOpinions(currentOpinions);
            renderAdminOpinionCards(root, currentOpinions);
            const nextAdminStatus = document.getElementById("admin-opinion-status");
            if (nextAdminStatus) {
                nextAdminStatus.textContent = "保存しました。";
            }
        });
    });
}

export function initAdminOpinionExchange() {
    const root = document.getElementById("admin-opinion-list");
    const status = document.getElementById("admin-opinion-status");
    if (!root) {
        return;
    }

    if (status) {
        status.textContent = "投稿一覧を読み込みました。";
    }

    renderAdminOpinionCards(root, loadLocalOpinions());
}