// src/api/MessageRuntime.ts
import { symbolInnerMessage } from "../runtimes/external-store/getExternalStoreMessage.js";
import { getThreadMessageText } from "../utils/getThreadMessageText.js";
import {
  MessageAttachmentRuntimeImpl
} from "./AttachmentRuntime.js";
import {
  EditComposerRuntimeImpl
} from "./ComposerRuntime.js";
import {
  MessagePartRuntimeImpl
} from "./MessagePartRuntime.js";
import { NestedSubscriptionSubject } from "./subscribable/NestedSubscriptionSubject.js";
import { SKIP_UPDATE } from "./subscribable/SKIP_UPDATE.js";
import { ShallowMemoizeSubject } from "./subscribable/ShallowMemoizeSubject.js";
var COMPLETE_STATUS = Object.freeze({
  type: "complete"
});
var toMessagePartStatus = (message, partIndex, part) => {
  if (message.role !== "assistant") return COMPLETE_STATUS;
  if (part.type === "tool-call") {
    if (!part.result) {
      return message.status;
    } else {
      return COMPLETE_STATUS;
    }
  }
  const isLastPart = partIndex === Math.max(0, message.content.length - 1);
  if (message.status.type === "requires-action") return COMPLETE_STATUS;
  return isLastPart ? message.status : COMPLETE_STATUS;
};
var getMessagePartState = (message, partIndex) => {
  const part = message.content[partIndex];
  if (!part) {
    return SKIP_UPDATE;
  }
  const status = toMessagePartStatus(message, partIndex, part);
  return Object.freeze({
    ...part,
    ...{ [symbolInnerMessage]: part[symbolInnerMessage] },
    status
  });
};
var MessageRuntimeImpl = class {
  constructor(_core, _threadBinding) {
    this._core = _core;
    this._threadBinding = _threadBinding;
    this.composer = new EditComposerRuntimeImpl(
      new NestedSubscriptionSubject({
        path: {
          ...this.path,
          ref: this.path.ref + `${this.path.ref}.composer`,
          composerSource: "edit"
        },
        getState: this._getEditComposerRuntimeCore,
        subscribe: (callback) => this._threadBinding.subscribe(callback)
      }),
      () => this._threadBinding.getState().beginEdit(this._core.getState().id)
    );
  }
  get path() {
    return this._core.path;
  }
  __internal_bindMethods() {
    this.reload = this.reload.bind(this);
    this.getState = this.getState.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.getMessagePartByIndex = this.getMessagePartByIndex.bind(this);
    this.getMessagePartByToolCallId = this.getMessagePartByToolCallId.bind(this);
    this.getAttachmentByIndex = this.getAttachmentByIndex.bind(this);
    this.unstable_getCopyText = this.unstable_getCopyText.bind(this);
    this.speak = this.speak.bind(this);
    this.stopSpeaking = this.stopSpeaking.bind(this);
    this.submitFeedback = this.submitFeedback.bind(this);
    this.switchToBranch = this.switchToBranch.bind(this);
  }
  composer;
  _getEditComposerRuntimeCore = () => {
    return this._threadBinding.getState().getEditComposer(this._core.getState().id);
  };
  getState() {
    return this._core.getState();
  }
  reload(reloadConfig = {}) {
    const editComposerRuntimeCore = this._getEditComposerRuntimeCore();
    const composerRuntimeCore = editComposerRuntimeCore ?? this._threadBinding.getState().composer;
    const composer = editComposerRuntimeCore ?? composerRuntimeCore;
    const { runConfig = composer.runConfig } = reloadConfig;
    const state = this._core.getState();
    if (state.role !== "assistant")
      throw new Error("Can only reload assistant messages");
    this._threadBinding.getState().startRun({
      parentId: state.parentId,
      sourceId: state.id,
      runConfig
    });
  }
  speak() {
    const state = this._core.getState();
    return this._threadBinding.getState().speak(state.id);
  }
  stopSpeaking() {
    const state = this._core.getState();
    const thread = this._threadBinding.getState();
    if (thread.speech?.messageId === state.id) {
      this._threadBinding.getState().stopSpeaking();
    } else {
      throw new Error("Message is not being spoken");
    }
  }
  submitFeedback({ type }) {
    const state = this._core.getState();
    this._threadBinding.getState().submitFeedback({
      messageId: state.id,
      type
    });
  }
  switchToBranch({
    position,
    branchId
  }) {
    const state = this._core.getState();
    if (branchId && position) {
      throw new Error("May not specify both branchId and position");
    } else if (!branchId && !position) {
      throw new Error("Must specify either branchId or position");
    }
    const thread = this._threadBinding.getState();
    const branches = thread.getBranches(state.id);
    let targetBranch = branchId;
    if (position === "previous") {
      targetBranch = branches[state.branchNumber - 2];
    } else if (position === "next") {
      targetBranch = branches[state.branchNumber];
    }
    if (!targetBranch) throw new Error("Branch not found");
    this._threadBinding.getState().switchToBranch(targetBranch);
  }
  unstable_getCopyText() {
    return getThreadMessageText(this.getState());
  }
  subscribe(callback) {
    return this._core.subscribe(callback);
  }
  getMessagePartByIndex(idx) {
    if (idx < 0) throw new Error("Message part index must be >= 0");
    return new MessagePartRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ...this.path,
          ref: this.path.ref + `${this.path.ref}.content[${idx}]`,
          messagePartSelector: { type: "index", index: idx }
        },
        getState: () => {
          return getMessagePartState(this.getState(), idx);
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core,
      this._threadBinding
    );
  }
  getMessagePartByToolCallId(toolCallId) {
    return new MessagePartRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ...this.path,
          ref: this.path.ref + `${this.path.ref}.content[toolCallId=${JSON.stringify(toolCallId)}]`,
          messagePartSelector: { type: "toolCallId", toolCallId }
        },
        getState: () => {
          const state = this._core.getState();
          const idx = state.content.findIndex(
            (part) => part.type === "tool-call" && part.toolCallId === toolCallId
          );
          if (idx === -1) return SKIP_UPDATE;
          return getMessagePartState(state, idx);
        },
        subscribe: (callback) => this._core.subscribe(callback)
      }),
      this._core,
      this._threadBinding
    );
  }
  getAttachmentByIndex(idx) {
    return new MessageAttachmentRuntimeImpl(
      new ShallowMemoizeSubject({
        path: {
          ...this.path,
          ref: this.path.ref + `${this.path.ref}.attachments[${idx}]`,
          attachmentSource: "message",
          attachmentSelector: { type: "index", index: idx }
        },
        getState: () => {
          const attachments = this.getState().attachments;
          const attachment = attachments?.[idx];
          if (!attachment) return SKIP_UPDATE;
          return {
            ...attachment,
            source: "message"
          };
        },
        subscribe: (callback) => this._core.subscribe(callback)
      })
    );
  }
};
export {
  MessageRuntimeImpl,
  toMessagePartStatus
};
//# sourceMappingURL=MessageRuntime.js.map