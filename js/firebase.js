import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
    addDoc,
    collection,
    getFirestore,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { RUNTIME_CONFIG } from "./runtime-config.js";

const state = {
    app: null,
    auth: null,
    db: null,
    storage: null,
    initialized: false
};

function getFirebaseConfig() {
    return RUNTIME_CONFIG?.firebase || {};
}

export function isFirebaseConfigured() {
    const cfg = getFirebaseConfig();
    return Boolean(
        cfg.apiKey
        && cfg.authDomain
        && cfg.projectId
        && cfg.storageBucket
        && cfg.messagingSenderId
        && cfg.appId
    );
}

function ensureInitialized() {
    if (state.initialized) {
        return state;
    }

    if (!isFirebaseConfigured()) {
        return null;
    }

    const cfg = getFirebaseConfig();
    state.app = getApps().length ? getApps()[0] : initializeApp(cfg);
    state.auth = getAuth(state.app);
    state.db = getFirestore(state.app);
    state.storage = getStorage(state.app);
    state.initialized = true;
    return state;
}

export function watchAuthState(callback) {
    const ctx = ensureInitialized();
    if (!ctx) {
        callback(null);
        return () => {};
    }
    return onAuthStateChanged(ctx.auth, callback);
}

export async function signInWithGoogle() {
    const ctx = ensureInitialized();
    if (!ctx) {
        throw new Error("Firebase設定が不足しています。");
    }

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(ctx.auth, provider);
    return result.user;
}

export async function signOutFirebase() {
    const ctx = ensureInitialized();
    if (!ctx) {
        return;
    }
    await signOut(ctx.auth);
}

export function getCurrentUser() {
    const ctx = ensureInitialized();
    return ctx?.auth?.currentUser || null;
}

export async function saveCalendarEventDraft(eventPayload) {
    const ctx = ensureInitialized();
    if (!ctx) {
        return { ok: false, reason: "not-configured" };
    }

    const user = ctx.auth.currentUser;
    if (!user) {
        return { ok: false, reason: "not-signed-in" };
    }

    await addDoc(collection(ctx.db, "calendarEvents"), {
        ...eventPayload,
        createdByUid: user.uid,
        createdByEmail: user.email || "",
        createdAt: serverTimestamp()
    });

    return { ok: true };
}

export async function saveMemberProfile(profilePayload, photoFile) {
    const ctx = ensureInitialized();
    if (!ctx) {
        return { ok: false, reason: "not-configured" };
    }

    const user = ctx.auth.currentUser;
    if (!user) {
        return { ok: false, reason: "not-signed-in" };
    }

    let photoUrl = "";
    if (photoFile instanceof File && photoFile.size > 0) {
        const safeName = `${Date.now()}-${photoFile.name}`.replace(/[^a-zA-Z0-9._-]/g, "_");
        const photoRef = ref(ctx.storage, `member-photos/${user.uid}/${safeName}`);
        const uploaded = await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(uploaded.ref);
    }

    await addDoc(collection(ctx.db, "memberProfiles"), {
        ...profilePayload,
        photoUrl,
        createdByUid: user.uid,
        createdByEmail: user.email || "",
        createdAt: serverTimestamp()
    });

    return { ok: true, photoUrl };
}
