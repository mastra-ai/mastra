/**
 * The one text budget for anything the supervisor reads: tool output, captured
 * questions, finding evidence. Shared so the capture site and the readers agree.
 */
export const MAX_TEXT = 600;

export function truncateText(text: string, max = MAX_TEXT): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
