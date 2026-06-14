/**
 * 写真アルバム表示モジュール
 *
 * 表示元は Google Drive フォルダを正とし、
 * listPhotosEndpoint が未設定の場合のみ mockPhotos を使用します。
 */

function createDriveFileUrls(file) {
    const fileId = file.id || "";
    return {
        viewUrl: file.viewUrl || file.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : "#"),
        downloadUrl: file.downloadUrl || file.webContentLink || (fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : "#"),
        thumbnailUrl: file.thumbnailUrl || file.thumbnailLink || ""
    };
}

function normalizeDriveFiles(data) {
    const rawFiles = Array.isArray(data) ? data : (Array.isArray(data?.files) ? data.files : []);
    return rawFiles
        .map((file) => {
            const name = String(file?.name || file?.title || "").trim();
            if (!name) {
                return null;
            }
            const urls = createDriveFileUrls(file);
            return {
                id: String(file?.id || ""),
                title: name,
                comment: String(file?.comment || file?.description || file?.metadataComment || "").trim(),
                viewUrl: urls.viewUrl,
                downloadUrl: urls.downloadUrl,
                thumbnailUrl: urls.thumbnailUrl
            };
        })
        .filter(Boolean);
}

function isConfiguredFolderId(folderId) {
    return Boolean(folderId && !String(folderId).includes("sample-"));
}

function toDriveFolderUrl(folderId) {
    return isConfiguredFolderId(folderId) ? `https://drive.google.com/drive/folders/${folderId}` : "";
}

async function getDrivePhotos(config, folderId) {
    const endpoint = config?.gallery?.drive?.listPhotosEndpoint;
    if (!isConfigured(endpoint) || !folderId) {
        return null;
    }

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "listPhotos",
                folderId
            })
        });
        if (!res.ok) {
            return [];
        }
        const data = await res.json();
        return normalizeDriveFiles(data);
    } catch {
        return [];
    }
}

function createPhotoGrid(photos) {
    const grid = document.createElement("div");
    grid.className = "photo-grid";

    if (!photos || photos.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note";
        empty.textContent = "このフォルダに写真はまだありません。";
        grid.appendChild(empty);
        return grid;
    }

    photos.forEach((photo) => {
        if (photo.thumbnailUrl) {
            const item = document.createElement("article");
            item.className = "photo-item";

            const link = document.createElement("a");
            link.href = photo.viewUrl || "#";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "photo-thumb";

            const img = document.createElement("img");
            img.src = photo.thumbnailUrl;
            img.alt = photo.title;
            img.loading = "lazy";
            link.appendChild(img);

            const caption = document.createElement("p");
            caption.className = "photo-title";
            caption.textContent = photo.title;

            if (photo.comment) {
                const memo = document.createElement("p");
                memo.className = "photo-comment";
                memo.textContent = photo.comment;
                item.append(link, caption, memo);
            } else {
                item.append(link, caption);
            }

            const actions = document.createElement("p");
            actions.className = "photo-actions";

            const view = document.createElement("a");
            view.href = photo.viewUrl || "#";
            view.target = "_blank";
            view.rel = "noopener noreferrer";
            view.textContent = "表示";

            const sep = document.createElement("span");
            sep.textContent = " / ";

            const dl = document.createElement("a");
            dl.href = photo.downloadUrl || photo.viewUrl || "#";
            dl.target = "_blank";
            dl.rel = "noopener noreferrer";
            dl.textContent = "ダウンロード";

            actions.append(view, sep, dl);
            item.append(actions);
            grid.appendChild(item);
            return;
        }

        const placeholder = document.createElement("div");
        placeholder.className = "photo-placeholder";
        placeholder.textContent = photo.title;
        placeholder.setAttribute("aria-label", photo.title);
        grid.appendChild(placeholder);
    });

    return grid;
}

function createAlbumCard(album, photos, sourceLabel) {
    const article = document.createElement("article");
    article.className = "card gallery-album";
    article.dataset.albumTitle = (album.title || "").toLowerCase();
    article.dataset.searchText = [
        album.title || "",
        album.description || "",
        ...(photos || []).map((photo) => `${photo.title || ""} ${photo.comment || ""}`)
    ].join(" ").toLowerCase();

    const header = document.createElement("div");
    header.className = "album-header";

    const heading = document.createElement("h2");
    heading.textContent = `${album.coverEmoji || "📷"} ${album.title}`;

    const meta = document.createElement("p");
    meta.className = "note";
    meta.textContent = `${album.year}年 ・ ${photos.length}件 ・ ${sourceLabel}`;

    header.append(heading, meta);

    const desc = document.createElement("p");
    desc.textContent = album.description;
    desc.style.margin = "10px 0 14px";

    const photoGrid = createPhotoGrid(photos);

    const folderUrl = toDriveFolderUrl(album.driveFolderId);
    if (folderUrl) {
        const driveLink = document.createElement("a");
        driveLink.className = "button-link";
        driveLink.href = folderUrl;
        driveLink.target = "_blank";
        driveLink.rel = "noopener noreferrer";
        driveLink.textContent = "フォルダを開く";
        article.append(header, desc, photoGrid, driveLink);
    } else {
        const driveDisabled = document.createElement("p");
        driveDisabled.className = "note";
        driveDisabled.textContent = "フォルダID未設定のためリンクを表示できません。config.js の driveFolderId を実フォルダIDへ更新してください。";
        article.append(header, desc, photoGrid, driveDisabled);
    }

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

function bindGalleryUploadForm(config, onUploaded) {
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
        if (typeof onUploaded === "function") {
            await onUploaded();
        }
    });
}

async function buildAlbumsForRender(config, albums) {
    const results = await Promise.all(albums.map(async (album) => {
        const drivePhotos = await getDrivePhotos(config, album.driveFolderId);
        if (drivePhotos !== null) {
            return {
                album,
                photos: drivePhotos,
                sourceLabel: "Drive"
            };
        }

        return {
            album,
            photos: (album.mockPhotos || []).map((photo) => ({
                title: photo.title || "",
                viewUrl: "",
                downloadUrl: "",
                thumbnailUrl: ""
            })),
            sourceLabel: "モック"
        };
    }));

    return results;
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

    let cards = [];

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

    const renderAlbums = async () => {
        if (albums.length === 0) {
            container.innerHTML = "<section class='card'><p>アルバムは準備中です。</p></section>";
            cards = [];
            applyFilters();
            return;
        }

        if (albumFilter) {
            const selected = albumFilter.value || "all";
            albumFilter.innerHTML = "<option value='all'>すべてのアルバム</option>";
            albums.forEach((album) => {
                const option = document.createElement("option");
                option.value = album.title;
                option.textContent = album.title;
                albumFilter.appendChild(option);
            });
            albumFilter.value = selected;
        }

        container.innerHTML = "";
        const albumData = await buildAlbumsForRender(config, albums);
        cards = albumData.map(({ album, photos, sourceLabel }) => {
            const card = createAlbumCard(album, photos, sourceLabel);
            container.appendChild(card);
            return card;
        });

        applyFilters();
    };

    albumFilter?.addEventListener("change", applyFilters);
    searchInput?.addEventListener("input", applyFilters);
    bindGalleryUploadForm(config, renderAlbums);
    renderAlbums();
}
