import type { PendingImage } from '../context/ComposerImagesContext';

/**
 * Unsent composer content, kept per chat so leaving the page (e.g. for
 * settings) and coming back finds it again. Text lives in sessionStorage so it
 * also survives a reload; images stay in memory because a few screenshots as
 * data URLs overflow sessionStorage's ~5 MB quota.
 */
const TEXT_KEY_PREFIX = 'factory-composer-draft:';
const images = new Map<string, PendingImage[]>();

export function readComposerText(scope: string): string {
  try {
    return sessionStorage.getItem(TEXT_KEY_PREFIX + scope) ?? '';
  } catch {
    return '';
  }
}

export function saveComposerText(scope: string, text: string): void {
  try {
    if (text) sessionStorage.setItem(TEXT_KEY_PREFIX + scope, text);
    else sessionStorage.removeItem(TEXT_KEY_PREFIX + scope);
  } catch {
    // Storage full or blocked: the composer still works, it just won't remember.
  }
}

export function readComposerImages(scope: string): PendingImage[] {
  return images.get(scope) ?? [];
}

export function saveComposerImages(scope: string, next: PendingImage[]): void {
  if (next.length > 0) images.set(scope, next);
  else images.delete(scope);
}

/** Forget every chat's unsent content, e.g. on sign-out so the next user in this tab never sees it. */
export function clearComposerDrafts(): void {
  images.clear();
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(TEXT_KEY_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was saved.
  }
}
