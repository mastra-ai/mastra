import type { AppendMessage, Unsubscribe } from "../../types";
import {
  ExportedMessageRepository,
  MessageRepository,
} from "../utils/MessageRepository";
import { DefaultThreadComposerRuntimeCore } from "../composer/DefaultThreadComposerRuntimeCore";
import {
  AddToolResultOptions,
  ThreadSuggestion,
  SubmitFeedbackOptions,
  ThreadRuntimeCore,
  SpeechState,
  RuntimeCapabilities,
  SubmittedFeedback,
  ThreadRuntimeEventType,
  StartRunConfig,
  ResumeRunConfig,
} from "../core/ThreadRuntimeCore";
import { DefaultEditComposerRuntimeCore } from "../composer/DefaultEditComposerRuntimeCore";
import { SpeechSynthesisAdapter } from "../adapters/speech/SpeechAdapterTypes";
import { FeedbackAdapter } from "../adapters/feedback/FeedbackAdapter";
import { AttachmentAdapter } from "../adapters/attachment";
import { getThreadMessageText } from "../../utils/getThreadMessageText";
import { ModelContextProvider } from "../../model-context";
import { ThreadMessageLike } from "../external-store";

type BaseThreadAdapters = {
  speech?: SpeechSynthesisAdapter | undefined;
  feedback?: FeedbackAdapter | undefined;
  attachments?: AttachmentAdapter | undefined;
};

export abstract class BaseThreadRuntimeCore implements ThreadRuntimeCore {
  private _subscriptions = new Set<() => void>();
  private _isInitialized = false;

  protected readonly repository = new MessageRepository();
  public abstract get adapters(): BaseThreadAdapters | undefined;
  public abstract get isDisabled(): boolean;
  public abstract get isLoading(): boolean;
  public abstract get suggestions(): readonly ThreadSuggestion[];
  public abstract get extras(): unknown;

  public abstract get capabilities(): RuntimeCapabilities;
  public abstract append(message: AppendMessage): void;
  public abstract startRun(config: StartRunConfig): void;
  public abstract resumeRun(config: ResumeRunConfig): void;
  public abstract addToolResult(options: AddToolResultOptions): void;
  public abstract cancelRun(): void;

  public get messages() {
    return this.repository.getMessages();
  }

  public get state() {
    let mostRecentAssistantMessage;
    for (const message of this.messages) {
      if (message.role === "assistant") {
        mostRecentAssistantMessage = message;
        break;
      }
    }

    return mostRecentAssistantMessage?.metadata.unstable_state ?? null;
  }

  public readonly composer = new DefaultThreadComposerRuntimeCore(this);

  constructor(private readonly _contextProvider: ModelContextProvider) {}

  public getModelContext() {
    return this._contextProvider.getModelContext();
  }

  private _editComposers = new Map<string, DefaultEditComposerRuntimeCore>();
  public getEditComposer(messageId: string) {
    return this._editComposers.get(messageId);
  }
  public beginEdit(messageId: string) {
    if (this._editComposers.has(messageId))
      throw new Error("Edit already in progress");

    this._editComposers.set(
      messageId,
      new DefaultEditComposerRuntimeCore(
        this,
        () => this._editComposers.delete(messageId),
        this.repository.getMessage(messageId),
      ),
    );
    this._notifySubscribers();
  }

  public getMessageById(messageId: string) {
    return this.repository.getMessage(messageId);
  }

  public getBranches(messageId: string): string[] {
    return this.repository.getBranches(messageId);
  }

  public switchToBranch(branchId: string): void {
    this.repository.switchToBranch(branchId);
    this._notifySubscribers();
  }

  protected _notifySubscribers() {
    for (const callback of this._subscriptions) callback();
  }

  public _notifyEventSubscribers(event: ThreadRuntimeEventType) {
    const subscribers = this._eventSubscribers.get(event);
    if (!subscribers) return;

    for (const callback of subscribers) callback();
  }

  public subscribe(callback: () => void): Unsubscribe {
    this._subscriptions.add(callback);
    return () => this._subscriptions.delete(callback);
  }

  private _submittedFeedback: Record<string, SubmittedFeedback> = {};

  public getSubmittedFeedback(messageId: string) {
    return this._submittedFeedback[messageId];
  }

  public submitFeedback({ messageId, type }: SubmitFeedbackOptions) {
    const adapter = this.adapters?.feedback;
    if (!adapter) throw new Error("Feedback adapter not configured");

    const { message } = this.repository.getMessage(messageId);
    adapter.submit({ message, type });

    this._submittedFeedback[messageId] = { type };
    this._notifySubscribers();
  }

  private _stopSpeaking: Unsubscribe | undefined;
  public speech: SpeechState | undefined;

  public speak(messageId: string) {
    const adapter = this.adapters?.speech;
    if (!adapter) throw new Error("Speech adapter not configured");

    const { message } = this.repository.getMessage(messageId);

    this._stopSpeaking?.();

    const utterance = adapter.speak(getThreadMessageText(message));
    const unsub = utterance.subscribe(() => {
      if (utterance.status.type === "ended") {
        this._stopSpeaking = undefined;
        this.speech = undefined;
      } else {
        this.speech = { messageId, status: utterance.status };
      }
      this._notifySubscribers();
    });

    this.speech = { messageId, status: utterance.status };
    this._notifySubscribers();

    this._stopSpeaking = () => {
      utterance.cancel();
      unsub();
      this.speech = undefined;
      this._stopSpeaking = undefined;
    };
  }

  public stopSpeaking() {
    if (!this._stopSpeaking) throw new Error("No message is being spoken");
    this._stopSpeaking();
    this._notifySubscribers();
  }

  protected ensureInitialized() {
    if (!this._isInitialized) {
      this._isInitialized = true;
      this._notifyEventSubscribers("initialize");
    }
  }

  // TODO import()/export() on external store doesn't make much sense
  public export() {
    return this.repository.export();
  }

  public import(data: ExportedMessageRepository) {
    this.ensureInitialized();
    this.repository.clear();
    this.repository.import(data);
    this._notifySubscribers();
  }

  public reset(initialMessages?: readonly ThreadMessageLike[]) {
    this.import(ExportedMessageRepository.fromArray(initialMessages ?? []));
  }

  private _eventSubscribers = new Map<
    ThreadRuntimeEventType,
    Set<() => void>
  >();

  public unstable_on(event: ThreadRuntimeEventType, callback: () => void) {
    if (event === "model-context-update") {
      return this._contextProvider.subscribe?.(callback) ?? (() => {});
    }

    const subscribers = this._eventSubscribers.get(event);
    if (!subscribers) {
      this._eventSubscribers.set(event, new Set([callback]));
    } else {
      subscribers.add(callback);
    }

    return () => {
      const subscribers = this._eventSubscribers.get(event)!;
      subscribers.delete(callback);
    };
  }
}
