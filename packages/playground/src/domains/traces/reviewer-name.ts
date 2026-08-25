const REVIEWER_NAME_STORAGE_KEY = 'mastra:studio:reviewer-name';

export function readReviewerName(): string {
  try {
    return window.localStorage.getItem(REVIEWER_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveReviewerName(name: string) {
  try {
    window.localStorage.setItem(REVIEWER_NAME_STORAGE_KEY, name);
  } catch {}
}
