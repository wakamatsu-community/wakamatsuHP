/**
 * 写真アルバム表示モジュール
 *
 * 将来は Google Drive API (files.list) でフォルダ内の画像一覧を取得します。
 * 現時点は config.js の mockPhotos を使用します。
 *
 * Drive API 連携時の置き換え先: getDrivePhotos() 関数
 */

/**
 * サムネイル用のプレースホルダーグリッドを生成します。
 */
function createPhotoGrid(photos) {
    const grid = document.createElement("div");
    grid.className = "photo-grid";

    photos.forEach((photo) => {
        const item = document.createElement("div");
        item.className = "photo-placeholder";
        item.textContent = photo.title;
        item.setAttribute("aria-label", photo.title);
        grid.appendChild(item);
    });

    return grid;
}

/**
 * アルバムカードを生成します。
 */
function createAlbumCard(album) {
    const article = document.createElement("article");
    article.className = "card gallery-album";
    article.dataset.albumTitle = (album.title || "").toLowerCase();
    article.dataset.searchText = [
        album.title || "",
        album.description || "",
        ...(album.mockPhotos || []).map((photo) => photo.title || "")
    ].join(" ").toLowerCase();

    const header = document.createElement("div");
    header.className = "album-header";

    const heading = document.createElement("h2");
    heading.textContent = `${album.coverEmoji} ${album.title}`;

    const meta = document.createElement("p");
    meta.className = "note";
    meta.textContent = `${album.year}年 ・ ${album.mockPhotos.length}件`;

    header.append(heading, meta);

    const desc = document.createElement("p");
    desc.textContent = album.description;
    desc.style.margin = "10px 0 14px";

    const photoGrid = createPhotoGrid(album.mockPhotos);

    const driveLink = document.createElement("a");
    driveLink.className = "button-link";
    driveLink.href = `https://drive.google.com/drive/folders/${album.driveFolderId}`;
    driveLink.target = "_blank";
    driveLink.rel = "noopener noreferrer";
    driveLink.textContent = "Google Drive で見る";

    article.append(header, desc, photoGrid, driveLink);
    return article;
}

function isConfigured(url) {
    return Boolean(url && !url.includes("sample-"));
}

async function createDriveFolder(config, folderName) {
    const endpoint = config?.gallery?.drive?.createFolderEndpoint;
    if (!isConfigured(endpoint)) {
        return null;
    }

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "createFolder",
                folderName,
                parentFolderId: config?.gallery?.drive?.rootFolderId || ""
            })
        });
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        return data?.folderId || null;
    } catch {
        return null;
    }
}

async function uploadPhotosToDrive(config, payload) {
    const endpoint = config?.gallery?.drive?.uploadEndpoint;
    if (!isConfigured(endpoint)) {
        return false;
    }

    try {
        const formData = new FormData();
        formData.append("action", "uploadPhotos");
        formData.append("folderId", payload.folderId);
        formData.append("uploaderName", payload.uploaderName);
        formData.append("comment", payload.comment);

        payload.files.forEach((file) => {
            formData.append("photos", file);
        });

        const res = await fetch(endpoint, {
            method: "POST",
            body: formData
        });
        return res.ok;
    } catch {
        return false;
    }
}

function bindGalleryUploadForm(config) {
    const form = document.getElementById("gallery-upload-form");
    const destinationSelect = document.getElementById("gallery-destination");
    const newFolderWrap = document.getElementById("new-folder-wrap");
    const newFolderInput = document.getElementById("new-folder-name");
    const status = document.getElementById("gallery-upload-status");
    if (!form || !destinationSelect || !newFolderWrap || !newFolderInput || !status) {
        return;
    }

    const destinations = config?.gallery?.destinations || [];
    destinations.forEach((dest) => {
        const option = document.createElement("option");
        option.value = dest.id;
        option.textContent = dest.label;
        destinationSelect.appendChild(option);
    });

    destinationSelect.addEventListener("change", () => {
        const isNew = destinationSelect.value === "new";
        newFolderWrap.classList.toggle("hidden", !isNew);
        newFolderInput.required = isNew;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fd = new FormData(form);

        const uploaderName = String(fd.get("uploaderName") || "").trim();
        const destination = String(fd.get("destination") || "");
        const folderName = String(fd.get("newFolderName") || "").trim();
        const comment = String(fd.get("comment") || "").trim();
        const files = (fd.getAll("photos") || []).filter((f) => f instanceof File && f.size > 0);

        if (!uploaderName || !destination || files.length === 0) {
            status.textContent = "投稿者名・保存先・写真ファイルを入力してください。";
            return;
        }

        let folderId = "";
        if (destination === "new") {
            if (!folderName) {
                status.textContent = "新規フォルダ名を入力してください。";
                return;
            }
            folderId = await createDriveFolder(config, folderName);
            if (!folderId) {
                status.textContent = "新規フォルダを作成できませんでした。Apps Script設定を確認してください。";
                return;
            }
        } else {
            const matched = destinations.find((d) => d.id === destination);
            folderId = matched?.folderId || "";
            if (!folderId) {
                status.textContent = "保存先フォルダが見つかりません。";
                return;
            }
        }

        const uploaded = await uploadPhotosToDrive(config, {
            folderId,
            uploaderName,
            comment,
            files
        });

        if (!uploaded) {
            status.textContent = "Drive投稿に失敗しました。Apps Script（uploadEndpoint）の設定を確認してください。";
            return;
        }

        status.textContent = "Google Driveへ写真を投稿しました。";
        form.reset();
        newFolderWrap.classList.add("hidden");
        newFolderInput.required = false;
    });
}

/**
 * ギャラリーページを初期化します。
 */
export function initGalleryPage(config) {
    const container = document.getElementById("gallery-root");
    if (!container) return;

    const albums = config?.gallery?.albums ?? [];
    const albumFilter = document.getElementById("gallery-album-filter");
    const searchInput = document.getElementById("gallery-search");
    const emptyState = document.getElementById("gallery-empty");

    if (albums.length === 0) {
        container.innerHTML = "<section class='card'><p>アルバムは準備中です。</p></section>";
        bindGalleryUploadForm(config);
        return;
    }

    if (albumFilter) {
        albums.forEach((album) => {
            const option = document.createElement("option");
            option.value = album.title;
            option.textContent = album.title;
            albumFilter.appendChild(option);
        });
    }

    const cards = albums.map((album) => {
        const card = createAlbumCard(album);
        container.appendChild(card);
        return card;
    });

    const applyFilters = () => {
        const selectedAlbum = albumFilter?.value || "all";
        const keyword = (searchInput?.value || "").trim().toLowerCase();
        let visibleCount = 0;

        cards.forEach((card) => {
            const titleText = card.dataset.albumTitle || "";
            const searchText = card.dataset.searchText || "";
            const byAlbum = selectedAlbum === "all" || titleText === selectedAlbum.toLowerCase();
            const byKeyword = keyword === "" || searchText.includes(keyword);
            const visible = byAlbum && byKeyword;
            card.classList.toggle("hidden", !visible);
            if (visible) {
                visibleCount += 1;
            }
        });

        if (emptyState) {
            emptyState.classList.toggle("hidden", visibleCount > 0);
        }
    };

    albumFilter?.addEventListener("change", applyFilters);
    searchInput?.addEventListener("input", applyFilters);
    applyFilters();
    bindGalleryUploadForm(config);
}
