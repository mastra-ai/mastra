import { Attachment } from "../../types/AttachmentTypes";
import { AppendMessage } from "../../types";
import { AttachmentAdapter } from "../adapters/attachment";
import { ComposerRuntimeCore, ComposerRuntimeEventType } from "../core/ComposerRuntimeCore";
import { MessageRole, RunConfig } from "../../types/AssistantTypes";
import { BaseSubscribable } from "../remote-thread-list/BaseSubscribable";
export declare abstract class BaseComposerRuntimeCore extends BaseSubscribable implements ComposerRuntimeCore {
    readonly isEditing = true;
    protected abstract getAttachmentAdapter(): AttachmentAdapter | undefined;
    getAttachmentAccept(): string;
    private _attachments;
    get attachments(): readonly Attachment[];
    protected setAttachments(value: readonly Attachment[]): void;
    abstract get canCancel(): boolean;
    get isEmpty(): boolean;
    private _text;
    get text(): string;
    private _role;
    get role(): "system" | "user" | "assistant";
    private _runConfig;
    get runConfig(): RunConfig;
    setText(value: string): void;
    setRole(role: MessageRole): void;
    setRunConfig(runConfig: RunConfig): void;
    private _emptyTextAndAttachments;
    private _onClearAttachments;
    reset(): Promise<void>;
    clearAttachments(): Promise<void>;
    send(): Promise<void>;
    cancel(): void;
    protected abstract handleSend(message: Omit<AppendMessage, "parentId" | "sourceId">): void;
    protected abstract handleCancel(): void;
    addAttachment(file: File): Promise<void>;
    removeAttachment(attachmentId: string): Promise<void>;
    private _eventSubscribers;
    protected _notifyEventSubscribers(event: ComposerRuntimeEventType): void;
    unstable_on(event: ComposerRuntimeEventType, callback: () => void): () => void;
}
//# sourceMappingURL=BaseComposerRuntimeCore.d.ts.map