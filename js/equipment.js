const STORAGE_KEY = "wakamatsu_equipment_reservations_v2";

function normalize(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, "");
}

function isConfigured(url) {
    return Boolean(url && !url.includes("sample-"));
}

function formatDate(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function inRange(target, start, end) {
    const t = normalize(target);
    return t >= normalize(start) && t <= normalize(end);
}

function itemListToLabel(items) {
    return items.map((item) => `${item.equipmentLabel} x${item.quantity}`).join(" / ");
}

function parseGvizJson(text) {
    const jsonText = text.replace(/^[^(]+\(/, "").replace(/\);?\s*$/, "");
    return JSON.parse(jsonText);
}

async function fetchSheetRows(url) {
    if (!isConfigured(url)) {
        return null;
    }
    try {
        const res = await fetch(url);
        const text = await res.text();
        const data = parseGvizJson(text);
        return data?.table?.rows || [];
    } catch {
        return null;
    }
}

function buildSearchIndex(items) {
    return items.map((item) => ({
        ...item,
        _search: normalize(`${item.label} ${(item.aliases || []).join(" ")}`)
    }));
}

function toFlatReservationItems(sourceList) {
    return sourceList.flatMap((entry) => {
        if (entry.items && Array.isArray(entry.items)) {
            return entry.items.map((item) => ({
                recordId: entry.id,
                name: entry.name,
                phone: entry.phone,
                group: entry.group,
                createdAt: entry.createdAt,
                equipmentId: item.equipmentId,
                equipmentLabel: item.equipmentLabel,
                quantity: Number(item.quantity || 1),
                loanDate: item.loanDate,
                returnDate: item.returnDate
            }));
        }

        return [{
            recordId: entry.id || `R-${Date.now()}`,
            name: entry.name || "",
            phone: entry.phone || "",
            group: entry.group || "",
            createdAt: entry.createdAt || new Date().toISOString(),
            equipmentId: entry.equipmentId,
            equipmentLabel: entry.equipmentLabel,
            quantity: Number(entry.quantity || 1),
            loanDate: entry.loanDate,
            returnDate: entry.returnDate
        }];
    });
}

async function loadEquipmentItems(config) {
    const rows = await fetchSheetRows(config?.equipment?.sheets?.masterSheetUrl);
    if (!rows) {
        return config?.equipment?.items || [];
    }

    const parsed = rows
        .map((row) => {
            const c = row.c || [];
            return {
                id: String(c[0]?.v || "").trim(),
                label: String(c[1]?.v || "").trim(),
                stock: Number(c[2]?.v || 1),
                aliases: String(c[3]?.v || "").split(",").map((x) => x.trim()).filter(Boolean)
            };
        })
        .filter((item) => item.id && item.label);

    return parsed.length > 0 ? parsed : (config?.equipment?.items || []);
}

async function loadReservationItems(config) {
    const rows = await fetchSheetRows(config?.equipment?.sheets?.reservationSheetUrl);
    if (rows) {
        const parsed = rows
            .map((row) => {
                const c = row.c || [];
                return {
                    recordId: String(c[0]?.v || `R-${Date.now()}`),
                    name: String(c[1]?.v || ""),
                    phone: String(c[2]?.v || ""),
                    group: String(c[3]?.v || ""),
                    equipmentId: String(c[4]?.v || ""),
                    equipmentLabel: String(c[5]?.v || ""),
                    quantity: Number(c[6]?.v || 1),
                    loanDate: String(c[7]?.v || ""),
                    returnDate: String(c[8]?.v || ""),
                    createdAt: String(c[9]?.v || new Date().toISOString())
                };
            })
            .filter((item) => item.equipmentId && item.loanDate && item.returnDate);

        if (parsed.length > 0) {
            return parsed;
        }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    const mockFlat = toFlatReservationItems(config?.equipment?.mockReservations || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockFlat));
    return mockFlat;
}

function saveReservationItemsLocal(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function submitToSheets(config, payload) {
    const endpoint = config?.equipment?.sheets?.submitEndpoint;
    if (!isConfigured(endpoint)) {
        return false;
    }
    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch {
        return false;
    }
}

function getUsedQuantity(flatItems, equipmentId, date) {
    return flatItems
        .filter((item) => item.equipmentId === equipmentId && inRange(date, item.loanDate, item.returnDate))
        .reduce((sum, item) => sum + Number(item.quantity || 1), 0);
}

function getMinRemainingOnRange(flatItems, equipmentId, stock, startDate, endDate) {
    let current = startDate;
    let minRemaining = stock;
    while (current <= endDate) {
        const dateStr = formatDate(current);
        const used = getUsedQuantity(flatItems, equipmentId, dateStr);
        minRemaining = Math.min(minRemaining, stock - used);
        current = addDays(current, 1);
    }
    return minRemaining;
}

function createGanttCell(dateStr, used, stock) {
    const cell = document.createElement("button");
    cell.type = "button";
    const remaining = stock - used;
    const statusClass = remaining <= 0 ? "loaned" : remaining < stock ? "partial" : "free";
    cell.className = `gantt-cell ${statusClass}`;
    cell.dataset.date = dateStr;
    cell.dataset.remaining = String(Math.max(0, remaining));
    cell.textContent = remaining <= 0 ? "満" : `空${remaining}`;
    return cell;
}

function applySheetLinks(config, ids) {
    const master = document.getElementById(ids.master);
    const reserve = document.getElementById(ids.reservation);
    const masterUrl = config?.equipment?.sheets?.masterEditUrl || "#";
    const reserveUrl = config?.equipment?.sheets?.reservationEditUrl || "#";

    if (master) {
        master.href = masterUrl;
        master.classList.toggle("disabled-link", masterUrl === "#");
    }
    if (reserve) {
        reserve.href = reserveUrl;
        reserve.classList.toggle("disabled-link", reserveUrl === "#");
    }
}

export async function initEquipmentPage(config) {
    const select = document.getElementById("equipment-select");
    const searchInput = document.getElementById("equipment-search");
    const selectedNote = document.getElementById("equipment-selected-note");
    const timelineStartInput = document.getElementById("timeline-start-date");
    const timelineReset = document.getElementById("timeline-reset");
    const ganttRoot = document.getElementById("equipment-gantt");
    const selectionNote = document.getElementById("gantt-selection-note");

    const form = document.getElementById("equipment-reservation-form");
    const formEquipment = document.getElementById("reserve-equipment");
    const formQuantity = document.getElementById("reserve-quantity");
    const formLoanDate = document.getElementById("reserve-loan-date");
    const formReturnDate = document.getElementById("reserve-return-date");
    const addItemButton = document.getElementById("add-reservation-item");
    const itemsList = document.getElementById("reservation-items");
    const itemsEmpty = document.getElementById("reservation-items-empty");
    const formStatus = document.getElementById("reservation-status");

    if (!select || !searchInput || !ganttRoot || !form || !timelineStartInput || !formQuantity || !addItemButton || !itemsList) {
        return;
    }

    applySheetLinks(config, {
        master: "equipment-master-sheet-link",
        reservation: "equipment-reservation-sheet-link"
    });

    const indexedItems = buildSearchIndex(await loadEquipmentItems(config));

    let filteredItems = indexedItems;
    let selectedItem = indexedItems[0] || null;
    let reservationItems = await loadReservationItems(config);
    let rangeStart = new Date();
    let tapStartDate = "";
    let pendingItems = [];

    function refreshPendingList() {
        itemsList.innerHTML = "";
        if (pendingItems.length === 0) {
            itemsEmpty?.classList.remove("hidden");
            return;
        }

        itemsEmpty?.classList.add("hidden");
        pendingItems.forEach((item, index) => {
            const li = document.createElement("li");
            li.textContent = `${item.equipmentLabel} x${item.quantity} / ${item.loanDate} 〜 ${item.returnDate}`;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "button mini-button";
            removeButton.textContent = "削除";
            removeButton.addEventListener("click", () => {
                pendingItems = pendingItems.filter((_, i) => i !== index);
                refreshPendingList();
                renderGantt();
            });

            li.appendChild(removeButton);
            itemsList.appendChild(li);
        });
    }

    function fillSelect(items) {
        const previous = select.value;
        select.innerHTML = "";

        items.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = `${item.label}（在庫${item.stock}）`;
            select.appendChild(option);
        });

        if (items.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "該当なし";
            select.appendChild(option);
            select.disabled = true;
            selectedItem = null;
            return;
        }

        select.disabled = false;
        const restored = items.find((item) => item.id === previous) || items[0];
        select.value = restored.id;
        selectedItem = restored;
    }

    function renderGantt() {
        ganttRoot.innerHTML = "";

        if (!selectedItem) {
            ganttRoot.innerHTML = "<p class='note'>備品が選択されていません。</p>";
            return;
        }

        const dateCount = Number(config?.equipment?.timelineDays || 14);
        const dates = Array.from({ length: dateCount }, (_, i) => formatDate(addDays(rangeStart, i)));

        const header = document.createElement("div");
        header.className = "gantt-header";
        header.innerHTML = "<span>日付</span>";

        dates.forEach((date) => {
            const label = document.createElement("span");
            label.textContent = date.slice(5).replace("-", "/");
            header.appendChild(label);
        });

        const row = document.createElement("div");
        row.className = "gantt-row";

        const nameCell = document.createElement("span");
        nameCell.className = "gantt-equipment-name";
        nameCell.textContent = selectedItem.label;
        row.appendChild(nameCell);

        const effectiveItems = [...reservationItems, ...pendingItems.map((item) => ({ ...item, recordId: "TEMP" }))];
        const stock = Number(selectedItem.stock || 1);

        dates.forEach((date) => {
            const used = getUsedQuantity(effectiveItems, selectedItem.id, date);
            const cell = createGanttCell(date, used, stock);
            cell.addEventListener("click", () => {
                const remaining = Number(cell.dataset.remaining || "0");
                if (remaining <= 0) {
                    selectionNote.textContent = "貸出中の日付は選択できません。";
                    return;
                }

                if (!tapStartDate || date < tapStartDate) {
                    tapStartDate = date;
                    formLoanDate.value = date;
                    formReturnDate.value = date;
                    formQuantity.max = String(remaining);
                    formQuantity.value = "1";
                    selectionNote.textContent = `開始日を ${date} に設定しました。`;
                } else {
                    formLoanDate.value = tapStartDate;
                    formReturnDate.value = date;
                    const minRemaining = getMinRemainingOnRange(
                        effectiveItems,
                        selectedItem.id,
                        stock,
                        new Date(tapStartDate),
                        new Date(date)
                    );
                    formQuantity.max = String(Math.max(1, minRemaining));
                    formQuantity.value = String(Math.min(Number(formQuantity.value || 1), Math.max(1, minRemaining)));
                    selectionNote.textContent = `利用期間を ${tapStartDate} 〜 ${date} に設定しました。`;
                }
            });
            row.appendChild(cell);
        });

        ganttRoot.append(header, row);
        selectedNote.textContent = `表示中: ${selectedItem.label}`;
        formEquipment.value = selectedItem.label;
    }

    function applySearch() {
        const keyword = normalize(searchInput.value);
        filteredItems = indexedItems.filter((item) => item._search.includes(keyword));
        fillSelect(filteredItems);
        tapStartDate = "";
        renderGantt();
    }

    function hasConflict(equipmentId, loanDate, returnDate, quantity) {
        const stock = Number((indexedItems.find((item) => item.id === equipmentId)?.stock) || 1);
        let current = new Date(loanDate);
        const end = new Date(returnDate);
        const effectiveItems = [...reservationItems, ...pendingItems.map((item) => ({ ...item, recordId: "TEMP" }))];

        while (current <= end) {
            const used = getUsedQuantity(effectiveItems, equipmentId, formatDate(current));
            if (used + quantity > stock) {
                return true;
            }
            current = addDays(current, 1);
        }
        return false;
    }

    addItemButton.addEventListener("click", () => {
        if (!selectedItem) {
            formStatus.textContent = "備品を選択してください。";
            return;
        }

        const quantity = Number(formQuantity.value || 1);
        const loanDate = String(formLoanDate.value || "");
        const returnDate = String(formReturnDate.value || "");

        if (!loanDate || !returnDate) {
            formStatus.textContent = "貸出日と返納日を選択してください。";
            return;
        }
        if (returnDate < loanDate) {
            formStatus.textContent = "返納日は貸出日以降を指定してください。";
            return;
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            formStatus.textContent = "数量は1以上の整数で入力してください。";
            return;
        }
        if (hasConflict(selectedItem.id, loanDate, returnDate, quantity)) {
            formStatus.textContent = "在庫を超えるため、この数量では予約できません。";
            return;
        }

        pendingItems.push({
            equipmentId: selectedItem.id,
            equipmentLabel: selectedItem.label,
            quantity,
            loanDate,
            returnDate
        });

        formStatus.textContent = `${selectedItem.label} x${quantity} を予約リストへ追加しました。`;
        tapStartDate = "";
        refreshPendingList();
        renderGantt();
    });

    fillSelect(filteredItems);
    const today = formatDate(new Date());
    timelineStartInput.value = today;
    rangeStart = new Date(today);
    renderGantt();
    refreshPendingList();

    searchInput.addEventListener("input", applySearch);
    select.addEventListener("change", () => {
        selectedItem = filteredItems.find((item) => item.id === select.value) || filteredItems[0] || null;
        tapStartDate = "";
        renderGantt();
    });
    timelineStartInput.addEventListener("change", () => {
        rangeStart = new Date(timelineStartInput.value || today);
        tapStartDate = "";
        renderGantt();
    });
    timelineReset.addEventListener("click", () => {
        rangeStart = new Date();
        timelineStartInput.value = formatDate(rangeStart);
        tapStartDate = "";
        renderGantt();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (pendingItems.length === 0) {
            formStatus.textContent = "先に備品を予約リストへ追加してください。";
            return;
        }

        const formData = new FormData(form);
        const name = String(formData.get("name") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const group = String(formData.get("group") || "").trim();

        if (!name || !phone || !group) {
            formStatus.textContent = "氏名・電話番号・組班を入力してください。";
            return;
        }

        const recordId = `R-${Date.now()}`;
        const createdAt = new Date().toISOString();

        const flatRows = pendingItems.map((item) => ({
            recordId,
            name,
            phone,
            group,
            equipmentId: item.equipmentId,
            equipmentLabel: item.equipmentLabel,
            quantity: item.quantity,
            loanDate: item.loanDate,
            returnDate: item.returnDate,
            createdAt
        }));

        const posted = await submitToSheets(config, {
            type: "equipmentReservation",
            recordId,
            name,
            phone,
            group,
            items: pendingItems
        });

        reservationItems = [...reservationItems, ...flatRows];
        if (!posted) {
            saveReservationItemsLocal(reservationItems);
            formStatus.textContent = `予約を登録しました（ローカル保存: ${itemListToLabel(pendingItems)}）。`;
        } else {
            formStatus.textContent = `予約をGoogle Sheetsへ登録しました（${itemListToLabel(pendingItems)}）。`;
        }

        pendingItems = [];
        tapStartDate = "";
        refreshPendingList();
        renderGantt();
        form.reset();
        formEquipment.value = selectedItem?.label || "";
        formQuantity.value = "1";
    });
}

export async function initAdminReturnAlerts(config) {
    const alertsRoot = document.getElementById("admin-return-alerts");
    const tableBody = document.getElementById("admin-reservation-table-body");
    if (!alertsRoot || !tableBody) {
        return;
    }

    applySheetLinks(config, {
        master: "admin-master-sheet-link",
        reservation: "admin-reservation-sheet-link"
    });

    const today = formatDate(new Date());
    const reservationItems = await loadReservationItems(config);

    const dueItems = reservationItems.filter((item) => item.returnDate <= today);

    alertsRoot.innerHTML = "";
    if (dueItems.length === 0) {
        alertsRoot.innerHTML = "<p class='note'>本日返納期限の備品はありません。</p>";
    } else {
        dueItems.forEach((item) => {
            const p = document.createElement("p");
            p.className = "admin-alert-item";
            p.textContent = `予約ID ${item.id}（${item.equipmentLabel} x${item.quantity}）の返納日が来ました。`;
            alertsRoot.appendChild(p);
        });
    }

    tableBody.innerHTML = "";
    reservationItems
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
        .forEach((item) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${item.equipmentLabel}</td>
                <td>${item.quantity}</td>
                <td>${item.loanDate}</td>
                <td>${item.returnDate}</td>
            `;
            tableBody.appendChild(row);
        });
}
