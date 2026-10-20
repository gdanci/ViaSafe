import crypto from "node:crypto";
import type { Config } from "./lib/config.js";
import type { SosLocation } from "./services/sosBroker.js";
import { getFirestore } from "./lib/firebase.js";

export type Contact = {
  id: string;
  label: string;
  phoneOrEmail?: string;
  fcmToken?: string;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
};

export type SosSession = {
  sessionId: string;
  userId: string;
  active: boolean;
  startedAt: string;
  stoppedAt?: string;
  lastLocation?: SosLocation;
};

export type FakeCall = {
  callId: string;
  userId: string;
  createdAt: string;
  objectKey?: string;
};

export type Store = {
  contactsByUserId: Map<string, Map<string, Contact>>;
  shareTokenToContact: Map<string, { userId: string; contactId: string }>;
  sosByUserId: Map<string, SosSession>;
  fakeCallsById: Map<string, FakeCall>;
  markDirty?: () => void;
};

type PersistedStore = {
  contactsByUserId: Array<[string, Contact[]]>;
  shareTokenToContact: Array<[string, { userId: string; contactId: string }]>;
  sosByUserId: Array<[string, SosSession]>;
  fakeCallsById: Array<[string, FakeCall]>;
};

const STORE_COLLECTION = "viasafe";
const STORE_DOC = "store";

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function ensureUserContacts(store: Store, userId: string) {
  let contacts = store.contactsByUserId.get(userId);
  if (!contacts) {
    contacts = new Map();
    store.contactsByUserId.set(userId, contacts);
  }
  return contacts;
}

export async function createStore(config: Config): Promise<Store> {
  const store: Store = {
    contactsByUserId: new Map(),
    shareTokenToContact: new Map(),
    sosByUserId: new Map(),
    fakeCallsById: new Map()
  };

  const db = getFirestore(config);

  let persisted: PersistedStore | null = null;
  try {
    const snap = await db.collection(STORE_COLLECTION).doc(STORE_DOC).get();
    if (snap.exists) persisted = snap.data() as PersistedStore;
  } catch {
    persisted = null;
  }

  if (persisted) {
    for (const [userId, contacts] of persisted.contactsByUserId || []) {
      store.contactsByUserId.set(userId, new Map(contacts.map((c) => [c.id, c])));
    }
    for (const [token, ref] of persisted.shareTokenToContact || []) {
      store.shareTokenToContact.set(token, ref);
    }
    for (const [userId, session] of persisted.sosByUserId || []) {
      store.sosByUserId.set(userId, session);
    }
    for (const [callId, call] of persisted.fakeCallsById || []) {
      store.fakeCallsById.set(callId, call);
    }
  }

  let dirty = false;
  let saving = false;
  const scheduleSave = async () => {
    if (saving) return;
    if (!dirty) return;
    saving = true;
    dirty = false;

    const data: PersistedStore = {
      contactsByUserId: Array.from(store.contactsByUserId.entries()).map(([userId, map]) => [userId, Array.from(map.values())]),
      shareTokenToContact: Array.from(store.shareTokenToContact.entries()),
      sosByUserId: Array.from(store.sosByUserId.entries()),
      fakeCallsById: Array.from(store.fakeCallsById.entries())
    };

    await db.collection(STORE_COLLECTION).doc(STORE_DOC).set(data, { merge: true });
    saving = false;
  };

  store.markDirty = () => {
    dirty = true;
    setTimeout(() => {
      scheduleSave().catch(() => {});
    }, 300);
  };

  return store;
}