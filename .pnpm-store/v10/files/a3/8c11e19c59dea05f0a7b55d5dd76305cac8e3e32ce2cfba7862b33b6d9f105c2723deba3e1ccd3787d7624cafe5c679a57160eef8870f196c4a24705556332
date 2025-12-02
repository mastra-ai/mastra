// src/runtimes/composer/DefaultEditComposerRuntimeCore.tsx
import { getThreadMessageText } from "../../utils/getThreadMessageText.js";
import { BaseComposerRuntimeCore } from "./BaseComposerRuntimeCore.js";
var DefaultEditComposerRuntimeCore = class extends BaseComposerRuntimeCore {
  constructor(runtime, endEditCallback, { parentId, message }) {
    super();
    this.runtime = runtime;
    this.endEditCallback = endEditCallback;
    this._parentId = parentId;
    this._sourceId = message.id;
    this._previousText = getThreadMessageText(message);
    this.setText(this._previousText);
    this.setRole(message.role);
    this.setAttachments(message.attachments ?? []);
    this._nonTextParts = message.content.filter((part) => part.type !== "text");
    this.setRunConfig({ ...runtime.composer.runConfig });
  }
  get canCancel() {
    return true;
  }
  getAttachmentAdapter() {
    return this.runtime.adapters?.attachments;
  }
  _nonTextParts;
  _previousText;
  _parentId;
  _sourceId;
  async handleSend(message) {
    const text = getThreadMessageText(message);
    if (text !== this._previousText) {
      this.runtime.append({
        ...message,
        content: [...message.content, ...this._nonTextParts],
        parentId: this._parentId,
        sourceId: this._sourceId
      });
    }
    this.handleCancel();
  }
  handleCancel() {
    this.endEditCallback();
    this._notifySubscribers();
  }
};
export {
  DefaultEditComposerRuntimeCore
};
//# sourceMappingURL=DefaultEditComposerRuntimeCore.js.map