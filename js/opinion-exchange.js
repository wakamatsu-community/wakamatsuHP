const OPINION_STORE_KEY = "wakamatsu_opinion_exchange_v1";
const OPINION_STATUS_UNCONFIRMED = "未確認";
const OPINION_STATUS_OPTIONS = ["検討中", "対応中", "解消", "その他"];

const DEFAULT_OPINIONS = [
    {
        id: "OP-1001",
        name: "",
        category: "清掃・ごみ",
        content: "○○の側溝にごみが放置されています。雨の前に確認できると助かります。",
        answered: false,
        status: OPINION_STATUS_UNCONFIRMED,
        reason: "",
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

function normalizeOpinionStatus(value) {
    const raw = String(value || "").trim();
    if (raw === "保留") {
        return "その他";
    }
    if (raw === OPINION_STATUS_UNCONFIRMED || OPINION_STATUS_OPTIONS.includes(raw)) {
        return raw;
    }
    return OPINION_STATUS_UNCONFIRMED;
}

function normalizeOpinion(opinion) {
    const status = normalizeOpinionStatus(opinion?.status);
    return {
        ...opinion,
        status,
        answered: Boolean(opinion?.answered),
        reason: status === OPINION_STATUS_UNCONFIRMED ? "" : String(opinion?.reason || "").trim()
    };
}

function loadLocalOpinions() {
    const saved = localStorage.getItem(OPINION_STORE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const normalized = Array.isArray(parsed) ? parsed.map(normalizeOpinion) : [];
            saveLocalOpinions(normalized);
            return normalized;
        } catch {
            localStorage.removeItem(OPINION_STORE_KEY);
        }
    }

    localStorage.setItem(OPINION_STORE_KEY, JSON.stringify(DEFAULT_OPINIONS));
    return [...DEFAULT_OPINIONS].map(normalizeOpinion);
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
    const status = normalizeOpinionStatus(opinion?.status);
    const reason = String(opinion?.reason || "").trim();
    if (status !== OPINION_STATUS_UNCONFIRMED && reason) {
        return `${status} - ${reason}`;
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
        const currentStatus = normalizeOpinionStatus(opinion.status);
        card.innerHTML = `
            <div class="opinion-entry-meta">
                <span class="status-badge" data-status="${escapeHtml(currentStatus)}">${escapeHtml(currentStatus)}</span>
                <span class="note">${escapeHtml(opinion.category || "未分類")}</span>
                <span class="note">${formatDate(opinion.updatedAt || opinion.createdAt)}</span>
            </div>
            <h3>${escapeHtml(opinion.content)}</h3>
            <p><strong>名前:</strong> ${escapeHtml(opinion.name || "匿名")}</p>
            ${opinion.answered ? '<p><strong>回答の有無:</strong> あり</p>' : ""}
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
        answered: false,
        status: OPINION_STATUS_UNCONFIRMED,
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
        const currentStatus = normalizeOpinionStatus(opinion.status);
        card.innerHTML = `
            <div class="opinion-admin-meta">
                <span class="status-badge" data-status="${escapeHtml(currentStatus)}">${escapeHtml(currentStatus)}</span>
                <span class="note">${escapeHtml(opinion.category || "未分類")}</span>
                <span class="note">${formatDate(opinion.updatedAt || opinion.createdAt)}</span>
            </div>
            <h3>${escapeHtml(opinion.content)}</h3>
            <p><strong>名前:</strong> ${escapeHtml(opinion.name || "匿名")}</p>
            ${opinion.answered ? '<p><strong>回答の有無:</strong> あり</p>' : ""}
            <form class="opinion-admin-form">
                <label>確認と返答
                    <select name="status">
                        <option value="未確認">未確認</option>
                        <option value="検討中">検討中</option>
                        <option value="対応中">対応中</option>
                        <option value="解消">解消</option>
                        <option value="その他">その他</option>
                    </select>
                </label>
                <label class="opinion-reason-field">
                    事由
                    <textarea name="reason" placeholder="管理者の対応内容や事由を入力"></textarea>
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
            select.value = normalizeOpinionStatus(opinion.status);
        }
        if (reasonInput instanceof HTMLTextAreaElement) {
            reasonInput.value = opinion.reason || "";
        }
        if (answeredInput instanceof HTMLInputElement) {
            answeredInput.checked = Boolean(opinion.answered);
        }

        const updateReasonVisibility = () => {
            const shouldShow = select instanceof HTMLSelectElement && select.value !== OPINION_STATUS_UNCONFIRMED;
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

            const nextStatus = normalizeOpinionStatus(select?.value);
            const nextReason = String(reasonInput?.value || "").trim();
            if (nextStatus !== OPINION_STATUS_UNCONFIRMED && !nextReason) {
                if (adminStatus) {
                    adminStatus.textContent = "未確認以外を選ぶ場合は事由を入力してください。";
                }
                return;
            }

            currentOpinions[index] = {
                ...currentOpinions[index],
                status: nextStatus,
                reason: nextStatus === OPINION_STATUS_UNCONFIRMED ? "" : nextReason,
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