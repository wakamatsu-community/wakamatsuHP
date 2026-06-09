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

function bindCreateForm(calendar) {
    const form = document.getElementById("calendar-create-form");
    const status = document.getElementById("calendar-create-status");
    if (!(form && status)) {
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        const title = String(fd.get("title") || "").trim();
        const start = String(fd.get("start") || "");
        const end = String(fd.get("end") || "");
        const location = String(fd.get("location") || "").trim();
        const description = String(fd.get("description") || "").trim();
        const allDay = fd.get("allDay") === "on";

        if (!title || !start) {
            status.textContent = "タイトルと開始日時は必須です。";
            return;
        }

        const newEvent = {
            id: `local-${Date.now()}`,
            title,
            start: allDay ? start.slice(0, 10) : toIsoDate(start),
            end: end ? (allDay ? end.slice(0, 10) : toIsoDate(end)) : "",
            allDay,
            location,
            description
        };

        const localEvents = loadLocalAddedEvents();
        saveLocalAddedEvents([...localEvents, newEvent]);
        calendar.addEvent(toLocalCalendarEvent(newEvent));

        const cloudSaved = await saveCalendarEventDraft({
            title,
            start: newEvent.start,
            end: newEvent.end,
            allDay,
            location,
            description
        });

        if (cloudSaved.ok) {
            status.textContent = "予定を追加しました（Firestoreにも保存済み）。";
        } else if (cloudSaved.reason === "not-signed-in") {
            status.textContent = "予定を追加しました（ローカル保存）。Firestoreへ保存するには管理ページでログインしてください。";
        } else {
            status.textContent = "予定を追加しました（ローカル保存）。";
        }

        form.reset();
    });
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

    bindCreateForm(calendar);

    const loginHint = document.getElementById("calendar-login-hint");
    if (loginHint) {
        loginHint.textContent = getCurrentUser()
            ? "現在ログイン中です。追加予定はFirestoreにも保存されます。"
            : "未ログインです。予定はローカル保存されます（管理ページでログインするとFirestoreにも保存）。";
    }
}
