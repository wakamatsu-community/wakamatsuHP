/**
 * ゴミ収集スケジュール管理
 *
 * 将来は Google Sheets の公開 JSON エンドポイントから取得します。
 * 現時点は config.js の mockSchedule を利用します。
 *
 * Google Sheets 公開方法:
 *   ファイル > 共有 > ウェブに公開 > JSON 形式でエクスポート
 *   URL例: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json
 *
 * スプレッドシート想定カラム:
 *   列A: dayIndex  0=日 1=月 … 6=土
 *   列B: label     月曜日 など
 *   列C: types     燃えるゴミ,資源ゴミ（カンマ区切り）
 */

/**
 * スプレッドシートの gviz JSON レスポンスを schedule 配列に変換します。
 * @param {object} raw - fetch で取得した JSON オブジェクト
 * @returns {Array<{dayIndex: number, label: string, types: string[]}>}
 */
function parseSheetResponse(raw) {
    const rows = raw?.table?.rows ?? [];
    return rows
        .map((row) => {
            const cells = row.c || [];
            const dayIndex = cells[0]?.v;
            const label    = cells[1]?.v ?? "";
            const typeStr  = cells[2]?.v ?? "";
            if (dayIndex == null) return null;
            return {
                dayIndex: Number(dayIndex),
                label,
                types: typeStr.split(",").map((t) => t.trim()).filter(Boolean)
            };
        })
        .filter(Boolean);
}

/**
 * スケジュールを読み込みます。
 * sheetUrl が設定されていれば Sheets から、なければ mockSchedule を返します。
 */
export async function loadTrashSchedule(config) {
    const sheetUrl = config?.trash?.sheetUrl;

    if (sheetUrl && !sheetUrl.includes("sample-sheet-id")) {
        try {
            const res = await fetch(sheetUrl);
            const text = await res.text();
            // gviz API は "/*O_o*/\ngoogle.visualization.Query.setResponse(...);" 形式で返す
            const jsonText = text.replace(/^[^(]+\(/, "").replace(/\);?\s*$/, "");
            return parseSheetResponse(JSON.parse(jsonText));
        } catch {
            // Sheets 取得失敗時はモックへフォールバック
        }
    }

    return Promise.resolve(config?.trash?.mockSchedule ?? []);
}

/**
 * スケジュール配列から今日・明日のゴミ収集メッセージを返します。
 */
export function getTodayTrashMessage(schedule) {
    const now      = new Date();
    const today    = now.getDay();
    const tomorrow = (today + 1) % 7;
    const hour     = now.getHours();

    const todayEntry    = schedule.find((s) => s.dayIndex === today);
    const tomorrowEntry = schedule.find((s) => s.dayIndex === tomorrow);

    if (todayEntry && hour < 8) {
        return `今日は「${todayEntry.types.join("・")}」の収集日です（8時まで）。`;
    }
    if (tomorrowEntry) {
        return `明日は「${tomorrowEntry.types.join("・")}」の収集日です。`;
    }
    return "今日・明日のゴミ収集はありません。";
}

/**
 * ゴミ収集バナーを初期化します。
 */
export async function initTrashBanner(config) {
    const trashText = document.getElementById("trash-text");
    if (!trashText) return;

    try {
        const schedule = await loadTrashSchedule(config);
        trashText.textContent = getTodayTrashMessage(schedule);
    } catch {
        trashText.textContent = "ゴミ収集情報を読み込めませんでした。";
    }
}
