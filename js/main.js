import { SITE_CONFIG } from "./config.js";
import { initCalendarPage } from "./calendar.js";
import { initDocumentsPage } from "./drive.js";
import { initMapPage } from "./map.js";
import { initFormsPage } from "./form.js";
import { initGalleryPage } from "./gallery.js";
import { initEquipmentPage, initAdminReturnAlerts } from "./equipment.js";
import { initManagedEventsPage, initAdminCommunityForms, loadAllManagedEvents } from "./community-admin.js";
import { initFirebaseAdminSection } from "./firebase-admin.js";

function setupNavigation() {
    const current = location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll(".nav-link");

    links.forEach((link) => {
        const href = link.getAttribute("href");
        if (href === current || (current === "" && href === "index.html")) {
            link.classList.add("active");
        }
    });

    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".global-nav");
    if (!toggle || !nav) {
        return;
    }

    toggle.addEventListener("click", () => {
        nav.classList.toggle("open");
    });
}

function isCommunityEvent(event) {
    const text = `${event?.category || ""} ${event?.title || ""}`.toLowerCase();
    return text.includes("学び") || text.includes("コミニティ") || text.includes("コミュニティ");
}

function parseEventDate(scheduleLabel) {
    const matched = String(scheduleLabel || "").match(/(\d{4}-\d{2}-\d{2})/);
    if (!matched) {
        return null;
    }
    const date = new Date(`${matched[1]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function formatDateLabel(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${month}/${day}(${weekday})`;
}

function renderHomeNews(listEl, events) {
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);

    const weeklyEvents = events
        .map((event) => ({
            ...event,
            date: parseEventDate(event.scheduleLabel),
            sourceLabel: isCommunityEvent(event) ? "コミニティ" : "行事予定"
        }))
        .filter((event) => event.date && event.date >= today && event.date < weekEnd)
        .sort((a, b) => a.date - b.date)
        .slice(0, 8);

    if (weeklyEvents.length === 0) {
        listEl.innerHTML = "<li><strong>今週:</strong> 新しい行事予定はありません</li>";
        return;
    }

    listEl.innerHTML = "";
    weeklyEvents.forEach((event) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${formatDateLabel(event.date)}:</strong> [${event.sourceLabel}] ${event.title}`;
        listEl.appendChild(li);
    });
}

async function setupHomePage(config) {
    const emergency = document.getElementById("emergency-text");
    if (emergency) {
        emergency.textContent = config?.emergency?.message || emergency.textContent;
    }

    const newsList = document.getElementById("home-news-list");
    if (!newsList) {
        return;
    }

    const events = await loadAllManagedEvents(config);
    renderHomeNews(newsList, events);
}

function setupDisasterPage(config) {
    const manual = document.getElementById("disaster-manual-link");
    if (manual) {
        manual.href = config?.drive?.disasterManualUrl || "#";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();

    const page = document.body.dataset.page;

    if (page === "home") {
        await setupHomePage(SITE_CONFIG);
    }

    if (page === "events") {
        initCalendarPage(SITE_CONFIG);
        await initManagedEventsPage(SITE_CONFIG);
    }

    if (page === "documents") {
        await initDocumentsPage(SITE_CONFIG);
    }

    if (page === "map") {
        initMapPage(SITE_CONFIG);
    }

    if (page === "equipment") {
        initFormsPage(SITE_CONFIG);
    }

    if (page === "equipment") {
        await initEquipmentPage(SITE_CONFIG);
    }

    if (page === "disaster") {
        setupDisasterPage(SITE_CONFIG);
    }

    if (page === "gallery") {
        initGalleryPage(SITE_CONFIG);
    }

    if (page === "admin") {
        await initAdminReturnAlerts(SITE_CONFIG);
        initAdminCommunityForms(SITE_CONFIG);
        initFirebaseAdminSection();
    }
});
