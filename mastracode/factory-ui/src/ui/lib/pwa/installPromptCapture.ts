/** Non-standard Chromium event; not in lib.dom, so typed locally. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let capturedPrompt: BeforeInstallPromptEvent | null = null;
let listening = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Starts listening for Chromium's `beforeinstallprompt` at app start. The
 * browser fires it once per page load, often before the signed-in shell that
 * renders the install banner has mounted, so the event is captured (and the
 * default mini-infobar suppressed) here and handed to `usePwaInstall` later.
 * Safe to call more than once.
 */
export function captureInstallPrompt(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    capturedPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    capturedPrompt = null;
    notify();
  });
}

export function getCapturedInstallPrompt(): BeforeInstallPromptEvent | null {
  return capturedPrompt;
}

/** Returns the captured prompt and clears it: a prompt event can only be used once. */
export function takeCapturedInstallPrompt(): BeforeInstallPromptEvent | null {
  const prompt = capturedPrompt;
  capturedPrompt = null;
  return prompt;
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
