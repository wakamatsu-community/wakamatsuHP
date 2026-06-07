import { SITE_CONFIG } from "./config.js";
import { initCalendarPage } from "./calendar.js";
import { initDocumentsPage } from "./drive.js";
import { initMapPage } from "./map.js";
import { initFormsPage } from "./form.js";
import { initGalleryPage } from "./gallery.js";
import { initEquipmentPage, initAdminReturnAlerts } from "./equipment.js";
import { initManagedEventsPage, initAdminCommunityForms } from "./community-admin.js";

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

function setupHomePage(config) {
    const emergency = document.getElementById("emergency-text");
    if (emergency) {
        emergency.textContent = config?.emergency?.message || emergency.textContent;
    }
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
        setupHomePage(SITE_CONFIG);
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
    }
});
