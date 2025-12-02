import type { Attachment, PendingAttachment, Unsubscribe } from "../../types";
import { MessageRole, RunConfig } from "../../types/AssistantTypes";

export type ComposerRuntimeEventType = "send" | "attachment_add";

export type ComposerRuntimeCore = Readonly<{
  isEditing: boolean;

  canCancel: boolean;
  isEmpty: boolean;

  attachments: readonly Attachment[];

  getAttachmentAccept(): string;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (attachmentId: string) => Promise<void>;

  text: string;
  setText: (value: string) => void;

  role: MessageRole;
  setRole: (role: MessageRole) => void;

  runConfig: RunConfig;
  setRunConfig: (runConfig: RunConfig) => void;

  reset: () => Promise<void>;
  clearAttachments: () => Promise<void>;

  send: () => void;
  cancel: () => void;

  subscribe: (callback: () => void) => Unsubscribe;

  unstable_on: (
    event: ComposerRuntimeEventType,
    callback: () => void,
  ) => Unsubscribe;
}>;

export type ThreadComposerRuntimeCore = ComposerRuntimeCore &
  Readonly<{
    attachments: readonly PendingAttachment[];
  }>;
