import type { MastraBrowser } from '@mastra/core/browser';
import type { ClientInputMessage, MouseInputMessage, KeyboardInputMessage } from './types.js';

// Valid CDP mouse event types
const VALID_MOUSE_EVENTS = new Set(['mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel']);

// Valid CDP keyboard event types
const VALID_KEYBOARD_EVENTS = new Set(['keyDown', 'keyUp', 'char']);

// Input dispatch queue per agent+thread to serialize input events
const inputQueues = new Map<string, Promise<void>>();

/**
 * Serialize input dispatch to maintain event ordering.
 * Input events must be processed in order to avoid race conditions.
 */
function enqueueInput(key: string, fn: () => Promise<void>): void {
  const current = inputQueues.get(key) ?? Promise.resolve();
  const next = current.then(fn).catch(() => {
    // Errors are handled inside fn, just ensure chain continues
  });
  inputQueues.set(key, next);
}

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
 * @param threadId - The thread ID for thread-scoped operations (optional)
 */
export function handleInputMessage(
  data: string,
  getToolset: (agentId: string) => MastraBrowser | undefined,
  agentId: string,
  threadId?: string,
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

  // Serialize input dispatch per agent+thread to maintain event ordering
  const queueKey = `${agentId}:${threadId ?? 'default'}`;

  switch (message.type) {
    case 'mouse':
      enqueueInput(queueKey, async () => {
        try {
          await injectMouse(toolset, message, threadId);
        } catch (err) {
          if (isDisconnectionError(err)) {
            notifyBrowserClosed(toolset, threadId);
          } else if (!isExpectedInjectionError(err)) {
            console.warn('[InputHandler] Mouse injection error:', err);
          }
        }
      });
      break;
    case 'keyboard':
      enqueueInput(queueKey, async () => {
        try {
          await injectKeyboard(toolset, message, threadId);
        } catch (err) {
          if (isDisconnectionError(err)) {
            notifyBrowserClosed(toolset, threadId);
          } else if (!isExpectedInjectionError(err)) {
            console.warn('[InputHandler] Keyboard injection error:', err);
          }
        }
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
  // Note: 'no cdp session' is handled by isExpectedInjectionError (startup race)
  // and should not trigger browser closed state
  return (
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
  return (
    msg.includes('no cdp session') ||
    msg.includes('browser not launched') ||
    msg.includes('not connected to browser') ||
    msg.includes('no active target') ||
    (msg.includes('target') && msg.includes('not attached'))
  );
}

/**
 * Notify the browser that it was closed externally.
 * This triggers the onBrowserClosed callbacks to update the UI.
 * If threadId is provided and the browser supports thread-specific closing,
 * only that thread's session is closed.
 */
function notifyBrowserClosed(toolset: MastraBrowser, threadId?: string): void {
  const browser = toolset as unknown as {
    closeThreadSession?: (threadId: string) => Promise<void>;
    handleBrowserDisconnected?: () => void;
  };

  // For thread-scoped browsers, close only the specific thread's session
  if (threadId && typeof browser.closeThreadSession === 'function') {
    void browser.closeThreadSession(threadId).catch(() => {
      // Fall back to global disconnect if thread-specific close fails
      browser.handleBrowserDisconnected?.();
    });
    return;
  }

  // Fall back to global disconnect handling
  browser.handleBrowserDisconnected?.();
}

// --- Input injection ---

/**
 * Inject a mouse event into the browser.
 */
async function injectMouse(toolset: MastraBrowser, msg: MouseInputMessage, threadId?: string): Promise<void> {
  await toolset.injectMouseEvent(
    {
      type: msg.eventType,
      x: msg.x,
      y: msg.y,
      button: msg.button,
      clickCount: msg.clickCount,
      deltaX: msg.deltaX,
      deltaY: msg.deltaY,
      modifiers: msg.modifiers,
    },
    threadId,
  );
}

/**
 * Inject a keyboard event into the browser.
 */
async function injectKeyboard(toolset: MastraBrowser, msg: KeyboardInputMessage, threadId?: string): Promise<void> {
  const windowsVirtualKeyCode = getVirtualKeyCode(msg.key);

  await toolset.injectKeyboardEvent(
    {
      type: msg.eventType,
      key: msg.key,
      code: msg.code,
      text: msg.text,
      modifiers: msg.modifiers,
      windowsVirtualKeyCode,
    },
    threadId,
  );
}

// --- Validation ---

/**
 * Type guard to validate incoming messages.
 * Validates structure and rejects invalid event types at the boundary.
 */
function isValidInputMessage(msg: unknown): msg is ClientInputMessage {
  if (typeof msg !== 'object' || msg === null) {
    return false;
  }

  const typed = msg as Record<string, unknown>;

  if (typed.type === 'mouse') {
    // Validate mouse message structure
    if (typeof typed.eventType !== 'string' || !VALID_MOUSE_EVENTS.has(typed.eventType)) {
      return false;
    }
    if (typeof typed.x !== 'number' || typeof typed.y !== 'number') {
      return false;
    }
    // Optional fields validation
    if (typed.button !== undefined && typeof typed.button !== 'string') {
      return false;
    }
    if (typed.deltaX !== undefined && typeof typed.deltaX !== 'number') {
      return false;
    }
    if (typed.deltaY !== undefined && typeof typed.deltaY !== 'number') {
      return false;
    }
    return true;
  }

  if (typed.type === 'keyboard') {
    // Validate keyboard message structure
    if (typeof typed.eventType !== 'string' || !VALID_KEYBOARD_EVENTS.has(typed.eventType)) {
      return false;
    }
    // At least one of key, code, or text should be present for meaningful input
    const hasKey = typeof typed.key === 'string';
    const hasCode = typeof typed.code === 'string';
    const hasText = typeof typed.text === 'string';
    if (!hasKey && !hasCode && !hasText) {
      return false;
    }
    // Optional modifiers validation
    if (typed.modifiers !== undefined && typeof typed.modifiers !== 'number') {
      return false;
    }
    return true;
  }

  return false;
}
