// src/runtimes/local/LocalRuntimeCore.tsx
import { BaseAssistantRuntimeCore } from "../core/BaseAssistantRuntimeCore.js";
import { LocalThreadRuntimeCore } from "./LocalThreadRuntimeCore.js";
import { LocalThreadListRuntimeCore } from "./LocalThreadListRuntimeCore.js";
import { ExportedMessageRepository } from "../utils/MessageRepository.js";
var LocalRuntimeCore = class extends BaseAssistantRuntimeCore {
  threads;
  Provider = void 0;
  _options;
  constructor(options, initialMessages) {
    super();
    this._options = options;
    this.threads = new LocalThreadListRuntimeCore(() => {
      return new LocalThreadRuntimeCore(this._contextProvider, this._options);
    });
    if (initialMessages) {
      this.threads.getMainThreadRuntimeCore().import(ExportedMessageRepository.fromArray(initialMessages));
    }
  }
};
export {
  LocalRuntimeCore
};
//# sourceMappingURL=LocalRuntimeCore.js.map