function openExternalForm(url) {
    if (!url) {
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
}

function bindEquipmentButtons(config) {
    const buttons = document.querySelectorAll(".equipment-reserve");

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.dataset.formKey;
            const url = config?.forms?.equipment?.[key];
            openExternalForm(url);
        });
    });
}

function bindContactForm(config) {
    const form = document.getElementById("contact-form");
    if (!form) {
        return;
    }

    const status = document.getElementById("contact-status");

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        openExternalForm(config?.forms?.contact);

        if (status) {
            status.textContent = "Googleフォームを新しいタブで開きました。内容を転記して送信してください。";
        }
    });
}

export function initFormsPage(config) {
    bindEquipmentButtons(config);
    bindContactForm(config);
}
