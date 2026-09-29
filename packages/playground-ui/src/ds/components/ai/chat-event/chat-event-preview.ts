import { truncateString } from '@/lib/truncate-string';

export function chatEventPreview(message: string): string {
  return truncateString(message, 72);
}
