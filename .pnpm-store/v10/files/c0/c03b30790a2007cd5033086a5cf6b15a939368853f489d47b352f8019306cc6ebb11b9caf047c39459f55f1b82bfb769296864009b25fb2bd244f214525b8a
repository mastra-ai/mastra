// src/runtimes/composer/BaseComposerRuntimeCore.tsx
import { BaseSubscribable } from "../remote-thread-list/BaseSubscribable.js";
var isAttachmentComplete = (a) => a.status.type === "complete";
var BaseComposerRuntimeCore = class extends BaseSubscribable {
  isEditing = true;
  getAttachmentAccept() {
    return this.getAttachmentAdapter()?.accept ?? "*";
  }
  _attachments = [];
  get attachments() {
    return this._attachments;
  }
  setAttachments(value) {
    this._attachments = value;
    this._notifySubscribers();
  }
  get isEmpty() {
    return !this.text.trim() && !this.attachments.length;
  }
  _text = "";
  get text() {
    return this._text;
  }
  _role = "user";
  get role() {
    return this._role;
  }
  _runConfig = {};
  get runConfig() {
    return this._runConfig;
  }
  setText(value) {
    if (this._text === value) return;
    this._text = value;
    this._notifySubscribers();
  }
  setRole(role) {
    if (this._role === role) return;
    this._role = role;
    this._notifySubscribers();
  }
  setRunConfig(runConfig) {
    if (this._runConfig === runConfig) return;
    this._runConfig = runConfig;
    this._notifySubscribers();
  }
  _emptyTextAndAttachments() {
    this._attachments = [];
    this._text = "";
    this._notifySubscribers();
  }
  async _onClearAttachments() {
    const adapter = this.getAttachmentAdapter();
    if (adapter) {
      await Promise.all(this._attachments.map((a) => adapter.remove(a)));
    }
  }
  async reset() {
    if (this._attachments.length === 0 && this._text === "" && this._role === "user" && Object.keys(this._runConfig).length === 0) {
      return;
    }
    this._role = "user";
    this._runConfig = {};
    const task = this._onClearAttachments();
    this._emptyTextAndAttachments();
    await task;
  }
  async clearAttachments() {
    const task = this._onClearAttachments();
    this.setAttachments([]);
    await task;
  }
  async send() {
    const adapter = this.getAttachmentAdapter();
    const attachments = adapter && this.attachments.length > 0 ? Promise.all(
      this.attachments.map(async (a) => {
        if (isAttachmentComplete(a)) return a;
        const result = await adapter.send(a);
        return result;
      })
    ) : [];
    const text = this.text;
    this._emptyTextAndAttachments();
    const message = {
      createdAt: /* @__PURE__ */ new Date(),
      role: this.role,
      content: text ? [{ type: "text", text }] : [],
      attachments: await attachments,
      runConfig: this.runConfig,
      metadata: { custom: {} }
    };
    this.handleSend(message);
    this._notifyEventSubscribers("send");
  }
  cancel() {
    this.handleCancel();
  }
  async addAttachment(file) {
    const adapter = this.getAttachmentAdapter();
    if (!adapter) throw new Error("Attachments are not supported");
    const upsertAttachment = (a) => {
      const idx = this._attachments.findIndex(
        (attachment) => attachment.id === a.id
      );
      if (idx !== -1)
        this._attachments = [
          ...this._attachments.slice(0, idx),
          a,
          ...this._attachments.slice(idx + 1)
        ];
      else {
        this._attachments = [...this._attachments, a];
        this._notifyEventSubscribers("attachment_add");
      }
      this._notifySubscribers();
    };
    const promiseOrGenerator = adapter.add({ file });
    if (Symbol.asyncIterator in promiseOrGenerator) {
      for await (const r of promiseOrGenerator) {
        upsertAttachment(r);
      }
    } else {
      upsertAttachment(await promiseOrGenerator);
    }
    this._notifyEventSubscribers("attachment_add");
    this._notifySubscribers();
  }
  async removeAttachment(attachmentId) {
    const adapter = this.getAttachmentAdapter();
    if (!adapter) throw new Error("Attachments are not supported");
    const index = this._attachments.findIndex((a) => a.id === attachmentId);
    if (index === -1) throw new Error("Attachment not found");
    const attachment = this._attachments[index];
    await adapter.remove(attachment);
    this._attachments = [
      ...this._attachments.slice(0, index),
      ...this._attachments.slice(index + 1)
    ];
    this._notifySubscribers();
  }
  _eventSubscribers = /* @__PURE__ */ new Map();
  _notifyEventSubscribers(event) {
    const subscribers = this._eventSubscribers.get(event);
    if (!subscribers) return;
    for (const callback of subscribers) callback();
  }
  unstable_on(event, callback) {
    const subscribers = this._eventSubscribers.get(event);
    if (!subscribers) {
      this._eventSubscribers.set(event, /* @__PURE__ */ new Set([callback]));
    } else {
      subscribers.add(callback);
    }
    return () => {
      const subscribers2 = this._eventSubscribers.get(event);
      if (!subscribers2) return;
      subscribers2.delete(callback);
    };
  }
};
export {
  BaseComposerRuntimeCore
};
//# sourceMappingURL=BaseComposerRuntimeCore.js.map