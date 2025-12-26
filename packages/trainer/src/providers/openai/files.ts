/**
 * OpenAI Files API wrapper.
 */

import type { OpenAIClient } from './client';

export interface OpenAIFile {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: 'uploaded' | 'processed' | 'error';
  status_details?: string;
}

export interface ListFilesResponse {
  object: 'list';
  data: OpenAIFile[];
}

export class OpenAIFilesAPI {
  constructor(private client: OpenAIClient) {}

  /**
   * Upload a file for fine-tuning.
   */
  async upload(
    content: Uint8Array,
    filename: string,
    purpose: 'fine-tune' | 'batch' | 'assistants',
  ): Promise<OpenAIFile> {
    const formData = new FormData();
    // Create a new ArrayBuffer from the Uint8Array to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(content.byteLength);
    new Uint8Array(buffer).set(content);
    // Use application/x-ndjson (NDJSON/JSONL MIME type) for fine-tuning files
    const blob = new Blob([buffer], { type: 'application/x-ndjson' });
    formData.append('file', blob, filename);
    formData.append('purpose', purpose);

    return this.client.postFormData<OpenAIFile>('/files', formData);
  }

  /**
   * Get file information.
   */
  async get(fileId: string): Promise<OpenAIFile> {
    return this.client.get<OpenAIFile>(`/files/${fileId}`);
  }

  /**
   * List files.
   */
  async list(purpose?: string): Promise<OpenAIFile[]> {
    const query = purpose ? `?purpose=${purpose}` : '';
    const response = await this.client.get<ListFilesResponse>(`/files${query}`);
    return response.data;
  }

  /**
   * Delete a file.
   */
  async delete(fileId: string): Promise<{ id: string; deleted: boolean }> {
    return this.client.delete(`/files/${fileId}`);
  }

  /**
   * Wait for file to be processed.
   */
  async waitForProcessing(
    fileId: string,
    timeoutMs: number = 60000,
    pollIntervalMs: number = 1000,
  ): Promise<OpenAIFile> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const file = await this.get(fileId);

      if (file.status === 'processed') {
        return file;
      }

      if (file.status === 'error') {
        throw new Error(`File processing failed: ${file.status_details || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`File processing timed out after ${timeoutMs}ms`);
  }
}
