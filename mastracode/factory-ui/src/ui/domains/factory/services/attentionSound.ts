import { playDoneSound } from '../../settings/services/doneSound';

const NOTIFIED_KEY = 'mastracode.attentionNotified.v2';
const LOCK_NAME = 'mastracode-attention-sound';
const MAX_SCOPES = 50;
const memoryClaims = new Map<string, string>();

function claimInMemory(scope: string, key: string): boolean {
  if (memoryClaims.get(scope) === key) return false;
  memoryClaims.delete(scope);
  memoryClaims.set(scope, key);
  if (memoryClaims.size > MAX_SCOPES) {
    const oldestScope = memoryClaims.keys().next().value;
    if (oldestScope) memoryClaims.delete(oldestScope);
  }
  return true;
}

function notifiedByScope(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function claimWithLocalStorage(scope: string, key: string): boolean {
  const notified = notifiedByScope();
  if (notified[scope] === key) return false;
  const entries = Object.entries(notified).filter(([existingScope]) => existingScope !== scope);
  entries.push([scope, key]);
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_SCOPES))));
    return true;
  } catch {
    return claimInMemory(scope, key);
  }
}

export async function playAttentionSoundOnce(scope: string, key: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    if (claimWithLocalStorage(scope, key)) playDoneSound();
    return;
  }
  try {
    await navigator.locks.request(LOCK_NAME, async () => {
      if (claimWithLocalStorage(scope, key)) playDoneSound();
    });
  } catch {
    if (claimInMemory(scope, key)) playDoneSound();
  }
}
