import { BaseAssistantRuntimeCore } from "../core/BaseAssistantRuntimeCore";
import { LocalThreadRuntimeCore } from "./LocalThreadRuntimeCore";
import { LocalRuntimeOptionsBase } from "./LocalRuntimeOptions";
import { LocalThreadListRuntimeCore } from "./LocalThreadListRuntimeCore";
import { ExportedMessageRepository } from "../utils/MessageRepository";
import { ThreadMessageLike } from "../external-store";

export class LocalRuntimeCore extends BaseAssistantRuntimeCore {
  public readonly threads;
  public readonly Provider = undefined;

  private _options: LocalRuntimeOptionsBase;

  constructor(
    options: LocalRuntimeOptionsBase,
    initialMessages: readonly ThreadMessageLike[] | undefined,
  ) {
    super();

    this._options = options;

    this.threads = new LocalThreadListRuntimeCore(() => {
      return new LocalThreadRuntimeCore(this._contextProvider, this._options);
    });

    if (initialMessages) {
      this.threads
        .getMainThreadRuntimeCore()
        .import(ExportedMessageRepository.fromArray(initialMessages));
    }
  }
}
