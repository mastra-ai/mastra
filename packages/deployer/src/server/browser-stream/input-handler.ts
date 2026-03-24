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
        console.warn('[InputHandler] Mouse injection error:', err);
      });
      break;
    case 'keyboard':
      void injectKeyboard(toolset, message).catch(err => {
        console.warn('[InputHandler] Keyboard injection error:', err);
      });
      break;
  }
}

// --- Validation ---

function isValidInputMessage(msg: unknown): msg is ClientInputMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;

  if (obj.type === 'mouse') return isValidMouseMessage(obj);
  if (obj.type === 'keyboard') return isValidKeyboardMessage(obj);
  return false;
}

const VALID_MOUSE_EVENTS = new Set(['mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel']);

function isValidMouseMessage(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.eventType === 'string' &&
    VALID_MOUSE_EVENTS.has(obj.eventType) &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    isFinite(obj.x) &&
    isFinite(obj.y) &&
    obj.x >= 0 &&
    obj.y >= 0
  );
}

const VALID_KEYBOARD_EVENTS = new Set(['keyDown', 'keyUp', 'char']);

function isValidKeyboardMessage(obj: Record<string, unknown>): boolean {
  return typeof obj.eventType === 'string' && VALID_KEYBOARD_EVENTS.has(obj.eventType);
}

// --- Injection ---

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

async function injectKeyboard(toolset: MastraBrowser, msg: KeyboardInputMessage): Promise<void> {
  await toolset.injectKeyboardEvent({
    type: msg.eventType,
    key: msg.key,
    code: msg.code,
    text: msg.text,
    modifiers: msg.modifiers,
    windowsVirtualKeyCode: getVirtualKeyCode(msg.key),
  });
}
