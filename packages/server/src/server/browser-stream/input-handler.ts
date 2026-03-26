import type { MastraBrowser } from '@mastra/core/browser';
import type { ClientInputMessage, MouseInputMessage, KeyboardInputMessage } from './types.js';

/**
 * Map of key names to Windows virtual key codes.
 * Required for non-printable keys (Enter, Tab, Arrow keys, etc.)
 * See: https://docs.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
 */
const VIRTUAL_KEY_CODES: Record<string, number> = {
  // Control keys
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Shift: 16,
  Control: 17,
  Alt: 18,
  Pause: 19,
  CapsLock: 20,
  Escape: 27,
  Space: 32,
  ' ': 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  // Arrow keys
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  // Editing keys
  Insert: 45,
  Delete: 46,
  // Function keys
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
};

/**
 * Get the Windows virtual key code for a key.
 * For printable characters, uses the character code.
 * For special keys, looks up in the mapping.
 */
function getVirtualKeyCode(key: string | undefined): number | undefined {
  if (!key) return undefined;

  // Check special keys first
  if (VIRTUAL_KEY_CODES[key] !== undefined) {
    return VIRTUAL_KEY_CODES[key];
  }

  // For single printable characters, use the uppercase char code
  if (key.length === 1) {
    return key.toUpperCase().charCodeAt(0);
  }

  return undefined;
}

/**
 * Handle an incoming WebSocket message by parsing, validating,
 * and routing to the appropriate toolset injection method.
 *
 * Fire-and-forget: no acknowledgment sent back to client.
 * Silently ignores malformed or unrecognized messages.
 *
 * @param data - Raw string data from WebSocket message
 * @param getToolset - Function to retrieve MastraBrowser for an agent
 * @param agentId - The agent ID this WebSocket connection is for
 */
export function handleInputMessage(
  data: string,
  getToolset: (agentId: string) => MastraBrowser | undefined,
  agentId: string,
): void {
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  if (!isValidInputMessage(message)) {
    return;
  }

  const toolset = getToolset(agentId);
  if (!toolset) {
    return;
  }

  switch (message.type) {
    case 'mouse':
      void injectMouse(toolset, message).catch(err => {
        if (isDisconnectionError(err)) {
          notifyBrowserClosed(toolset);
        } else if (!isExpectedInjectionError(err)) {
          console.warn('[InputHandler] Mouse injection error:', err);
        }
      });
      break;
    case 'keyboard':
      void injectKeyboard(toolset, message).catch(err => {
        if (isDisconnectionError(err)) {
          notifyBrowserClosed(toolset);
        } else if (!isExpectedInjectionError(err)) {
          console.warn('[InputHandler] Keyboard injection error:', err);
        }
      });
      break;
    case 'relaunch':
      void relaunchBrowser(toolset).catch(err => {
        console.warn('[InputHandler] Browser relaunch error:', err);
      });
      break;
  }
}

// --- Error handling ---

/**
 * Check if an error indicates browser disconnection (target closed).
 * These errors mean the browser was externally closed.
 */
function isDisconnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('no cdp session') ||
    msg.includes('target closed') ||
    msg.includes('browser has been closed') ||
    msg.includes('page has been closed') ||
    msg.includes('session closed') ||
    msg.includes('browser has disconnected')
  );
}

/**
 * Check if an injection error is expected (browser not ready yet).
 * These are silently ignored to avoid log spam.
 */
function isExpectedInjectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('no cdp session');
}

/**
 * Notify the browser that it was closed externally.
 * This triggers the onBrowserClosed callbacks to update the UI.
 */
function notifyBrowserClosed(toolset: MastraBrowser): void {
  // Call handleBrowserDisconnected if available (it's public on the implementations)
  const browser = toolset as unknown as { handleBrowserDisconnected?: () => void };
  if (typeof browser.handleBrowserDisconnected === 'function') {
    browser.handleBrowserDisconnected();
  }
}

/**
 * Relaunch the browser by calling ensureReady().
 * This is triggered when the user clicks the "Browser Closed" overlay.
 * If there was a previous URL, navigate back to it.
 */
async function relaunchBrowser(toolset: MastraBrowser): Promise<void> {
  const lastUrl = toolset.getLastUrl();
  console.info(`[InputHandler] Relaunching browser...${lastUrl ? ` (restoring: ${lastUrl})` : ''}`);

  await toolset.ensureReady();

  // Restore the last URL if available
  if (lastUrl) {
    await toolset.navigateTo(lastUrl);
  }
}

// --- Input injection ---

/**
 * Inject a mouse event into the browser.
 */
async function injectMouse(toolset: MastraBrowser, msg: MouseInputMessage): Promise<void> {
  await toolset.injectMouseEvent({
    type: msg.eventType,
    x: msg.x,
    y: msg.y,
    button: msg.button,
    clickCount: msg.clickCount,
    deltaX: msg.deltaX,
    deltaY: msg.deltaY,
    modifiers: msg.modifiers,
  });
}

/**
 * Inject a keyboard event into the browser.
 */
async function injectKeyboard(toolset: MastraBrowser, msg: KeyboardInputMessage): Promise<void> {
  const windowsVirtualKeyCode = getVirtualKeyCode(msg.key);

  await toolset.injectKeyboardEvent({
    type: msg.eventType,
    key: msg.key,
    code: msg.code,
    text: msg.text,
    modifiers: msg.modifiers,
    windowsVirtualKeyCode,
  });
}

// --- Validation ---

/**
 * Type guard to validate incoming messages.
 */
function isValidInputMessage(msg: unknown): msg is ClientInputMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }

  const typed = msg as Record<string, unknown>;

  if (typed.type === 'mouse') {
    return typeof typed.eventType === 'string' && typeof typed.x === 'number' && typeof typed.y === 'number';
  }

  if (typed.type === 'keyboard') {
    return typeof typed.eventType === 'string';
  }

  if (typed.type === 'relaunch') {
    return true;
  }

  return false;
}
