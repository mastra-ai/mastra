import type { AttachmentAdapter, PendingAttachment, CompleteAttachment } from '@assistant-ui/react';

export class PDFAttachmentAdapter implements AttachmentAdapter {
  public accept = 'application/pdf';

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    // Validate file size
    const maxSize = 20 * 1024 * 1024; // 20MB limit
    if (file.size > maxSize) {
      throw new Error('PDF size exceeds 20MB limit');
    }

    return {
      id: crypto.randomUUID(),
      type: 'document',
      name: file.name,
      file,
      status: {
        type: 'running',
        reason: 'uploading',
        progress: 0,
      },
      contentType: 'application/pdf',
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    // Convert to base64 for API processing.
    const base64Data = await this.fileToBase64(attachment.file);

    return {
      id: attachment.id,
      type: 'document',
      name: attachment.name,
      content: [
        {
          type: 'text',
          text: base64Data,
        },
      ],
      status: { type: 'complete' },
      contentType: 'application/pdf',
    };
  }

  async remove(): Promise<void> {
    // Cleanup if needed
  }

  private async fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
}
