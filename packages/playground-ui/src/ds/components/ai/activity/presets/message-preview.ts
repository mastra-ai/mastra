import { truncateString } from '@/lib/truncate-string';

export function messagePreview(message: string): string {
  return truncateString(message, 72);
}

export function messagePreviewShowsAll(message: string): boolean {
  return !message.includes('\n') && messagePreview(message) === message;
}
