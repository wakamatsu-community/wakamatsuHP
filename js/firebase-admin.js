import {
    getCurrentUser,
    isFirebaseConfigured,
    saveMemberProfile,
    signInWithGoogle,
    signOutFirebase,
    watchAuthState
} from "./firebase.js";

function setAuthUi(user) {
    const status = document.getElementById("login-status");
    const signin = document.getElementById("google-signin-btn");
    const signout = document.getElementById("google-signout-btn");

    if (!(status && signin && signout)) {
        return;
    }

    if (user) {
        status.textContent = `ログイン中: ${user.displayName || user.email || "ユーザー"}`;
        signin.disabled = true;
        signout.disabled = false;
    } else {
        status.textContent = "未ログインです。個人情報・写真の保存には Google ログインが必要です。";
        signin.disabled = false;
        signout.disabled = true;
    }
}

export function initFirebaseAdminSection() {
    const signin = document.getElementById("google-signin-btn");
    const signout = document.getElementById("google-signout-btn");
    const status = document.getElementById("login-status");
    const form = document.getElementById("admin-member-profile-form");
    const formStatus = document.getElementById("admin-member-profile-status");

    if (!(signin && signout && status)) {
        return;
    }

    if (!isFirebaseConfigured()) {
        status.textContent = "Firebaseの環境変数が未設定です。`.env.local` または GitHub Secrets を設定してください。";
        signin.disabled = true;
        signout.disabled = true;
    } else {
        const unsubscribe = watchAuthState((user) => setAuthUi(user));
        window.addEventListener("beforeunload", () => unsubscribe());

        signin.addEventListener("click", async () => {
            try {
                await signInWithGoogle();
            } catch {
                status.textContent = "Googleログインに失敗しました。Firebase Authentication設定を確認してください。";
            }
        });

        signout.addEventListener("click", async () => {
            await signOutFirebase();
            setAuthUi(null);
        });
    }

    if (!(form && formStatus)) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const user = getCurrentUser();
        if (!user) {
            formStatus.textContent = "先に Google ログインしてください。";
            return;
        }

        const fd = new FormData(form);
        const payload = {
            name: String(fd.get("name") || "").trim(),
            phone: String(fd.get("phone") || "").trim(),
            group: String(fd.get("group") || "").trim(),
            note: String(fd.get("note") || "").trim()
        };

        if (!payload.name || !payload.phone || !payload.group) {
            formStatus.textContent = "氏名・電話番号・組班は必須です。";
            return;
        }

        const photo = fd.get("photo");

        try {
            const result = await saveMemberProfile(payload, photo);
            formStatus.textContent = result.ok
                ? "Firestore / Storage に保存しました。"
                : "保存に失敗しました。";
            if (result.ok) {
                form.reset();
            }
        } catch {
            formStatus.textContent = "保存エラーが発生しました。Firebaseルールを確認してください。";
        }
    });
}
