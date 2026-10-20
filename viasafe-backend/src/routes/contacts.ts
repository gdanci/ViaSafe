import express from "express";
import { z } from "zod";
import type { Config } from "../lib/config.js";
import { ensureUserContacts, newId, Store } from "../store.js";

const createContactSchema = z.object({
  label: z.string().min(1).max(100),
  phoneOrEmail: z.string().min(1).max(200).optional(),
  fcmToken: z.string().min(1).max(4096).optional()
});

const updateContactSchema = createContactSchema.partial().refine((o) => Object.keys(o).length > 0, {
  message: "No fields to update"
});

export function contactsRouter({ config, store }: { config: Config; store: Store }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const userId = req.userId!;
    const contacts = Array.from(ensureUserContacts(store, userId).values());
    res.json({ contacts });
  });

  router.post("/", (req, res) => {
    const userId = req.userId!;
    const body = createContactSchema.parse(req.body);

    const contactId = newId("c");
    const shareToken = newId("share");
    const now = new Date().toISOString();

    const contact = {
      id: contactId,
      label: body.label,
      phoneOrEmail: body.phoneOrEmail,
      fcmToken: body.fcmToken,
      shareToken,
      createdAt: now,
      updatedAt: now
    };

    ensureUserContacts(store, userId).set(contactId, contact);
    store.shareTokenToContact.set(shareToken, { userId, contactId });
    (store as any).markDirty?.();

    res.status(201).json({
      contact,
      watchUrl: `${config.publicBaseUrl}/watch/${shareToken}`
    });
  });

  router.put("/:id", (req, res) => {
    const userId = req.userId!;
    const contactId = String(req.params.id);
    const patch = updateContactSchema.parse(req.body);

    const contacts = ensureUserContacts(store, userId);
    const existing = contacts.get(contactId);
    if (!existing) return res.status(404).json({ error: "Contact not found" });

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    contacts.set(contactId, updated);
    (store as any).markDirty?.();

    res.json({ contact: updated, watchUrl: `${config.publicBaseUrl}/watch/${updated.shareToken}` });
  });

  router.delete("/:id", (req, res) => {
    const userId = req.userId!;
    const contactId = String(req.params.id);

    const contacts = ensureUserContacts(store, userId);
    const existing = contacts.get(contactId);
    if (!existing) return res.status(404).json({ error: "Contact not found" });

    contacts.delete(contactId);
    store.shareTokenToContact.delete(existing.shareToken);
    (store as any).markDirty?.();

    res.status(204).end();
  });

  return router;
}