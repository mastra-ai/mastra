const DEFAULT_THREAD_NAME_PATTERN = /^New Thread \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const MAX_AUTO_TITLE_LENGTH = 80;

export function isDefaultThreadName(name: string): boolean {
  return DEFAULT_THREAD_NAME_PATTERN.test(name);
}

export function deriveThreadTitleFromMessage(input: string): string {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_AUTO_TITLE_LENGTH) return collapsed;
  return `${collapsed.slice(0, MAX_AUTO_TITLE_LENGTH - 1).trimEnd()}…`;
}
