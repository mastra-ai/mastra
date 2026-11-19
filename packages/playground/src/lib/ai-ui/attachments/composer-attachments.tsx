/* oxlint-disable react/only-export-components -- re-export shim; the provider and hook stay together for existing imports */
export {
  ComposerAttachmentsProvider,
  useComposerAttachments,
} from '@mastra/playground-ui/domains/agents/chat/attachments/composer-attachments';
export type {
  ComposerAttachment,
  ComposerAttachmentKind,
} from '@mastra/playground-ui/domains/agents/chat/attachments/composer-attachments';
