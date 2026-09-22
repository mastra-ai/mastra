import { truncateString } from '@/lib/truncate-string';

export function chatEventPreview(message: string): string {
  return truncateString(message, 72);
}

/**
 * A row already ends in the message when the preview holds all of it — one line,
 * short enough to survive the truncation. Folding such a row opens on a copy of
 * what is already on screen, so the presets leave the disclosure off.
 */
export function chatEventPreviewShowsAll(message: string): boolean {
  return !message.includes('\n') && chatEventPreview(message) === message;
}
