// src/api/AssistantRuntime.ts
import { ThreadListRuntimeImpl } from "./ThreadListRuntime.js";
import { ExportedMessageRepository } from "../runtimes/index.js";
var AssistantRuntimeImpl = class {
  constructor(_core) {
    this._core = _core;
    this.threads = new ThreadListRuntimeImpl(_core.threads);
    this._thread = this.threads.main;
  }
  threads;
  get threadList() {
    return this.threads;
  }
  _thread;
  __internal_bindMethods() {
    this.switchToNewThread = this.switchToNewThread.bind(this);
    this.switchToThread = this.switchToThread.bind(this);
    this.registerModelContextProvider = this.registerModelContextProvider.bind(this);
    this.registerModelConfigProvider = this.registerModelConfigProvider.bind(this);
    this.reset = this.reset.bind(this);
  }
  get thread() {
    return this._thread;
  }
  switchToNewThread() {
    return this._core.threads.switchToNewThread();
  }
  switchToThread(threadId) {
    return this._core.threads.switchToThread(threadId);
  }
  registerModelContextProvider(provider) {
    return this._core.registerModelContextProvider(provider);
  }
  registerModelConfigProvider(provider) {
    return this.registerModelContextProvider(provider);
  }
  reset({
    initialMessages
  } = {}) {
    return this._core.threads.getMainThreadRuntimeCore().import(ExportedMessageRepository.fromArray(initialMessages ?? []));
  }
};
export {
  AssistantRuntimeImpl
};
//# sourceMappingURL=AssistantRuntime.js.map