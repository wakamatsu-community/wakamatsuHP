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

/** 学びの会用の iframe を生成します。 */
function createLearningEmbed(url) {
    const iframe = document.createElement("iframe");
    iframe.className = "embed-frame learning-calendar-embed";
    iframe.src = url;
    iframe.title = "コミニティカレンダー";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    return iframe;
}

/** イベントページのカレンダーを初期化します。 */
export function initCalendarPage(config) {
    const mainContainer = document.getElementById("calendar-main");
    if (mainContainer && config?.calendar?.mainUrl) {
        mainContainer.appendChild(createMainEmbed(config.calendar.mainUrl));
    }

    const learningContainer = document.getElementById("calendar-learning");
    if (learningContainer && config?.calendar?.learningUrl) {
        learningContainer.appendChild(createLearningEmbed(config.calendar.learningUrl));
    }
}
