import { AssistantRuntimeCore } from "../runtimes/core/AssistantRuntimeCore";
import { ModelContextProvider } from "../model-context/ModelContextTypes";
import { ThreadRuntime } from "./ThreadRuntime";
import { Unsubscribe } from "../types";
import { ThreadListRuntime, ThreadListRuntimeImpl } from "./ThreadListRuntime";
import { ExportedMessageRepository, ThreadMessageLike } from "../runtimes";

export type AssistantRuntime = {
  /**
   * The threads in this assistant.
   */
  readonly threads: ThreadListRuntime;

  /**
   * The currently selected main thread. Equivalent to `threads.main`.
   */
  readonly thread: ThreadRuntime;

  /**
   * @deprecated This field was renamed to `threads`.
   */
  readonly threadList: ThreadListRuntime;

  /**
   * Switch to a new thread.
   *
   * @deprecated This method was moved to `threads.switchToNewThread`.
   */
  switchToNewThread(): void;

  /**
   * Switch to a thread.
   *
   * @param threadId The thread ID to switch to.
   * @deprecated This method was moved to `threads.switchToThread`.
   */
  switchToThread(threadId: string): void;

  /**
   * Register a model context provider. Model context providers are configuration such as system message, temperature, etc. that are set in the frontend.
   *
   * @param provider The model context provider to register.
   */
  registerModelContextProvider(provider: ModelContextProvider): Unsubscribe;

  /**
   * @deprecated This method was renamed to `registerModelContextProvider`.
   */
  registerModelConfigProvider(provider: ModelContextProvider): Unsubscribe;

  /**
   * @deprecated Use `runtime.thread.reset(initialMessages)`.
   */
  reset: unknown; // make it a type error
};

export class AssistantRuntimeImpl implements AssistantRuntime {
  public readonly threads;
  public get threadList() {
    return this.threads;
  }

  public readonly _thread: ThreadRuntime;

  public constructor(private readonly _core: AssistantRuntimeCore) {
    this.threads = new ThreadListRuntimeImpl(_core.threads);
    this._thread = this.threads.main;
  }

  protected __internal_bindMethods() {
    this.switchToNewThread = this.switchToNewThread.bind(this);
    this.switchToThread = this.switchToThread.bind(this);
    this.registerModelContextProvider =
      this.registerModelContextProvider.bind(this);
    this.registerModelConfigProvider =
      this.registerModelConfigProvider.bind(this);
    this.reset = this.reset.bind(this);
  }

  public get thread() {
    return this._thread;
  }

  public switchToNewThread() {
    return this._core.threads.switchToNewThread();
  }

  public switchToThread(threadId: string) {
    return this._core.threads.switchToThread(threadId);
  }

  public registerModelContextProvider(provider: ModelContextProvider) {
    return this._core.registerModelContextProvider(provider);
  }

  public registerModelConfigProvider(provider: ModelContextProvider) {
    return this.registerModelContextProvider(provider);
  }

  public reset({
    initialMessages,
  }: { initialMessages?: ThreadMessageLike[] } = {}) {
    return this._core.threads
      .getMainThreadRuntimeCore()
      .import(ExportedMessageRepository.fromArray(initialMessages ?? []));
  }
}
