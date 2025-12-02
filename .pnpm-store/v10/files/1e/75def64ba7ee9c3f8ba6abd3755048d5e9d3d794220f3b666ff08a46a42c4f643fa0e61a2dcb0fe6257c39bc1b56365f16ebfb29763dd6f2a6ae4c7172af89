import {
  Attachment,
  PendingAttachment,
  CompleteAttachment,
} from "../../../types/AttachmentTypes";

/**
 * Interface for handling file attachments in the assistant runtime.
 *
 * AttachmentAdapter provides methods for managing file attachments throughout
 * their lifecycle: adding, processing, removing, and sending attachments with messages.
 *
 * @example
 * ```tsx
 * const imageAdapter: AttachmentAdapter = {
 *   accept: "image/*",
 *
 *   async add({ file }) {
 *     return {
 *       id: generateId(),
 *       type: "image",
 *       name: file.name,
 *       file,
 *       status: { type: "uploading" }
 *     };
 *   },
 *
 *   async remove(attachment) {
 *     // Clean up resources
 *   },
 *
 *   async send(attachment) {
 *     const url = await uploadFile(attachment.file);
 *     return { ...attachment, url, status: { type: "complete" } };
 *   }
 * };
 * ```
 */
export type AttachmentAdapter = {
  /**
   * MIME type pattern for accepted file types (e.g., "image/*", "text/plain").
   */
  accept: string;

  /**
   * Processes a file when it's added as an attachment.
   *
   * @param state - Object containing the file to process
   * @param state.file - The File object to be attached
   * @returns Promise or AsyncGenerator yielding PendingAttachment states
   */
  add(state: {
    file: File;
  }): Promise<PendingAttachment> | AsyncGenerator<PendingAttachment, void>;

  /**
   * Removes an attachment and cleans up associated resources.
   *
   * @param attachment - The attachment to remove
   * @returns Promise that resolves when removal is complete
   */
  remove(attachment: Attachment): Promise<void>;

  /**
   * Finalizes an attachment for sending with a message.
   *
   * @param attachment - The pending attachment to finalize
   * @returns Promise resolving to the complete attachment
   */
  send(attachment: PendingAttachment): Promise<CompleteAttachment>;
};
