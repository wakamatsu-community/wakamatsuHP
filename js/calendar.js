import { RUNTIME_CONFIG } from "./runtime-config.js";
import { getCurrentUser, saveCalendarEventDraft } from "./firebase.js";

const LOCAL_ADDED_EVENTS_KEY = "wakamatsu_calendar_added_events_v1";

function toIsoDate(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toISOString();
}

function toDatetimeLocalValue(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function loadLocalAddedEvents() {
    try {
        const raw = localStorage.getItem(LOCAL_ADDED_EVENTS_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveLocalAddedEvents(events) {
    localStorage.setItem(LOCAL_ADDED_EVENTS_KEY, JSON.stringify(events));
}

function buildGoogleCalendarUrl() {
    const apiKey = RUNTIME_CONFIG?.google?.calendarApiKey || "";
    const calendarId = RUNTIME_CONFIG?.google?.calendarId || "";
    if (!apiKey || !calendarId) {
        return "";
    }

    const params = new URLSearchParams({
        key: apiKey,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
        timeMin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
        timeMax: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()
    });

    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
}

async function fetchGoogleCalendarEvents() {
    const url = buildGoogleCalendarUrl();
    if (!url) {
        return [];
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return [];
        }
        const payload = await response.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];

        return items.map((item) => {
            const isAllDay = Boolean(item?.start?.date && !item?.start?.dateTime);
            return {
                id: item.id,
                title: item.summary || "(タイトル未設定)",
                start: item?.start?.dateTime || item?.start?.date,
                end: item?.end?.dateTime || item?.end?.date,
                allDay: isAllDay,
                backgroundColor: "#247246",
                borderColor: "#247246",
                extendedProps: {
                    location: item.location || "",
                    description: item.description || "",
                    source: "google"
                }
            };
        });
    } catch {
        return [];
    }
}

function toLocalCalendarEvent(event) {
    return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end || "",
        allDay: Boolean(event.allDay),
        backgroundColor: "#ec7b3a",
        borderColor: "#ec7b3a",
        extendedProps: {
            location: event.location || "",
            description: event.description || "",
            source: "local"
        }
    };
}

function renderEventDetailModal(info) {
    const title = document.getElementById("calendar-selected-event-title");
    const datetime = document.getElementById("calendar-selected-event-datetime");
    const location = document.getElementById("calendar-selected-event-location");
    const description = document.getElementById("calendar-selected-event-description");

    if (!(title && datetime && location && description)) {
        return;
    }

    const event = info.event;
    title.textContent = event.title || "(タイトル未設定)";
    datetime.textContent = event.start
        ? event.start.toLocaleString("ja-JP")
        : "日時未設定";
    location.textContent = event.extendedProps?.location || "場所未設定";
    description.textContent = event.extendedProps?.description || "説明なし";
}

async function saveTownCalendarEvent(formData) {
    const title = String(formData.get("title") || "").trim();
    const start = String(formData.get("start") || "");
    const end = String(formData.get("end") || "");
    const location = String(formData.get("location") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const allDay = formData.get("allDay") === "on";

    if (!title || !start) {
        return { ok: false, message: "イベント名と開始日時は必須です。" };
    }

    const event = {
        id: `local-${Date.now()}`,
        title,
        start: allDay ? start.slice(0, 10) : toIsoDate(start),
        end: end ? (allDay ? end.slice(0, 10) : toIsoDate(end)) : "",
        allDay,
        location,
        description
    };

    const localEvents = loadLocalAddedEvents();
    saveLocalAddedEvents([...localEvents, event]);

    const cloudSaved = await saveCalendarEventDraft({
        title,
        start: event.start,
        end: event.end,
        allDay,
        location,
        description
    });

    if (cloudSaved.ok) {
        return { ok: true, message: "町内会カレンダー予定を登録しました（Firestoreにも保存済み）。" };
    }

    if (cloudSaved.reason === "not-signed-in") {
        return { ok: true, message: "町内会カレンダー予定を登録しました（ローカル保存）。管理者ログイン中はFirestoreにも保存されます。" };
    }

    return { ok: true, message: "町内会カレンダー予定を登録しました（ローカル保存）。" };
}

function setCalendarConnectionStatus(message) {
    const status = document.getElementById("calendar-connection-status");
    if (status) {
        status.textContent = message;
    }
}

export async function initCalendarPage() {
    const calendarRoot = document.getElementById("custom-calendar");
    if (!calendarRoot) {
        return;
    }

    if (!window.FullCalendar) {
        setCalendarConnectionStatus("FullCalendarの読み込みに失敗しました。");
        return;
    }

    const calendar = new window.FullCalendar.Calendar(calendarRoot, {
        locale: "ja",
        initialView: "dayGridMonth",
        height: "auto",
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listMonth"
        },
        buttonText: {
            today: "今日",
            month: "月",
            week: "週",
            list: "一覧"
        },
        eventClick: renderEventDetailModal
    });

    calendar.render();

    const googleEvents = await fetchGoogleCalendarEvents();
    const localEvents = loadLocalAddedEvents().map(toLocalCalendarEvent);

    googleEvents.forEach((event) => calendar.addEvent(event));
    localEvents.forEach((event) => calendar.addEvent(event));

    if (googleEvents.length > 0) {
        setCalendarConnectionStatus("Google Calendar APIから予定を取得しました。オレンジ色はサイトから追加した予定です。");
    } else {
        setCalendarConnectionStatus("Google Calendar APIの取得結果が0件、または環境変数未設定です。`GOOGLE_CALENDAR_API_KEY` と `GOOGLE_CALENDAR_ID` を確認してください。");
    }
}

export function initAdminCalendarForm() {
    const form = document.getElementById("admin-calendar-create-form");
    const status = document.getElementById("admin-calendar-create-status");
    if (!(form && status)) {
        return;
    }

    const loginState = getCurrentUser();
    if (!loginState) {
        status.textContent = "管理者ログインなしでも登録はできますが、ローカル保存になります。";
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const result = await saveTownCalendarEvent(new FormData(form));
        status.textContent = result.message;
        if (result.ok) {
            form.reset();
            const startInput = form.querySelector('input[name="start"]');
            if (startInput instanceof HTMLInputElement) {
                startInput.value = toDatetimeLocalValue(new Date());
            }
        }
    });
}
