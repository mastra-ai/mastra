import { Attachment, PendingAttachment } from "../types/AttachmentTypes";
import { ComposerRuntimeEventType } from "../runtimes/core/ComposerRuntimeCore";
import { Unsubscribe } from "../types";
import { AttachmentRuntime, EditComposerAttachmentRuntimeImpl, ThreadComposerAttachmentRuntimeImpl } from "./AttachmentRuntime";
import { ComposerRuntimePath } from "./RuntimePathTypes";
import { MessageRole, RunConfig } from "../types/AssistantTypes";
import type { ThreadComposerRuntimeCoreBinding, EditComposerRuntimeCoreBinding, ComposerRuntimeCoreBinding } from "./RuntimeBindings";
export type { ThreadComposerRuntimeCoreBinding, EditComposerRuntimeCoreBinding, ComposerRuntimeCoreBinding, };
type BaseComposerState = {
    readonly canCancel: boolean;
    readonly isEditing: boolean;
    readonly isEmpty: boolean;
    readonly text: string;
    readonly role: MessageRole;
    readonly attachments: readonly Attachment[];
    readonly runConfig: RunConfig;
};
export type ThreadComposerState = BaseComposerState & {
    readonly type: "thread";
    readonly attachments: readonly PendingAttachment[];
};
export type EditComposerState = BaseComposerState & {
    readonly type: "edit";
};
export type ComposerState = ThreadComposerState | EditComposerState;
export type ComposerRuntime = {
    readonly path: ComposerRuntimePath;
    readonly type: "edit" | "thread";
    /**
     * Get the current state of the composer. Includes any data that has been added to the composer.
     */
    getState(): ComposerState;
    getAttachmentAccept(): string;
    /**
     * Given a standard js File object, add it to the composer. A composer can have multiple attachments.
     * @param file The file to add to the composer.
     */
    addAttachment(file: File): Promise<void>;
    /**
     * Set the text of the composer.
     * @param text The text to set in the composer.
     */
    setText(text: string): void;
    /**
     * Set the role of the composer. For instance, if you'd like a specific message to have the 'assistant' role, you can do so here.
     * @param role The role to set in the composer.
     */
    setRole(role: MessageRole): void;
    /**
     * Set the run config of the composer. This is used to send custom configuration data to the model.
     * Within your backend, you can access this data using the `runConfig` object.
     * Example:
     * ```ts
     * composerRuntime.setRunConfig({
     *   custom: { customField: "customValue" }
     * });
     * ```
     * @param runConfig The run config to set in the composer.
     */
    setRunConfig(runConfig: RunConfig): void;
    /**
     * Reset the composer. This will clear the entire state of the composer, including all text and attachments.
     */
    reset(): Promise<void>;
    /**
     * Clear all attachments from the composer.
     */
    clearAttachments(): Promise<void>;
    /**
     * Send a message. This will send whatever text or attachments are in the composer.
     */
    send(): void;
    /**
     * Cancel the current run. In edit mode, this will exit edit mode.
     */
    cancel(): void;
    /**
     * Listens for changes to the composer state.
     * @param callback The callback to call when the composer state changes.
     */
    subscribe(callback: () => void): Unsubscribe;
    /**
     * Get an attachment by index.
     * @param idx The index of the attachment to get.
     */
    getAttachmentByIndex(idx: number): AttachmentRuntime;
};
export declare abstract class ComposerRuntimeImpl implements ComposerRuntime {
    protected _core: ComposerRuntimeCoreBinding;
    get path(): ComposerRuntimePath;
    abstract get type(): "edit" | "thread";
    constructor(_core: ComposerRuntimeCoreBinding);
    protected __internal_bindMethods(): void;
    abstract getState(): ComposerState;
    setText(text: string): void;
    setRunConfig(runConfig: RunConfig): void;
    addAttachment(file: File): Promise<void>;
    reset(): Promise<void>;
    clearAttachments(): Promise<void>;
    send(): void;
    cancel(): void;
    setRole(role: MessageRole): void;
    subscribe(callback: () => void): Unsubscribe;
    private _eventSubscriptionSubjects;
    unstable_on(event: ComposerRuntimeEventType, callback: () => void): Unsubscribe;
    getAttachmentAccept(): string;
    abstract getAttachmentByIndex(idx: number): AttachmentRuntime;
}
export type ThreadComposerRuntime = Omit<ComposerRuntime, "getState" | "getAttachmentByIndex"> & {
    readonly path: ComposerRuntimePath & {
        composerSource: "thread";
    };
    readonly type: "thread";
    getState(): ThreadComposerState;
    getAttachmentByIndex(idx: number): AttachmentRuntime & {
        source: "thread-composer";
    };
};
export declare class ThreadComposerRuntimeImpl extends ComposerRuntimeImpl implements ThreadComposerRuntime {
    get path(): ComposerRuntimePath & {
        composerSource: "thread";
    };
    get type(): "thread";
    private _getState;
    constructor(core: ThreadComposerRuntimeCoreBinding);
    getState(): ThreadComposerState;
    getAttachmentByIndex(idx: number): ThreadComposerAttachmentRuntimeImpl;
}
export type EditComposerRuntime = Omit<ComposerRuntime, "getState" | "getAttachmentByIndex"> & {
    readonly path: ComposerRuntimePath & {
        composerSource: "edit";
    };
    readonly type: "edit";
    getState(): EditComposerState;
    beginEdit(): void;
    getAttachmentByIndex(idx: number): AttachmentRuntime & {
        source: "edit-composer";
    };
};
export declare class EditComposerRuntimeImpl extends ComposerRuntimeImpl implements EditComposerRuntime {
    private _beginEdit;
    get path(): ComposerRuntimePath & {
        composerSource: "edit";
    };
    get type(): "edit";
    private _getState;
    constructor(core: EditComposerRuntimeCoreBinding, _beginEdit: () => void);
    __internal_bindMethods(): void;
    getState(): EditComposerState;
    beginEdit(): void;
    getAttachmentByIndex(idx: number): EditComposerAttachmentRuntimeImpl;
}
//# sourceMappingURL=ComposerRuntime.d.ts.map