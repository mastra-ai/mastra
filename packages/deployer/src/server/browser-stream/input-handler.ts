import type { BrowserToolsetLike } from '@mastra/core/agent';
import type { ClientInputMessage, MouseInputMessage, KeyboardInputMessage } from './types.js';

/**
 * Handle an incoming WebSocket message by parsing, validating,
 * and routing to the appropriate toolset injection method.
 *
 * Fire-and-forget: no acknowledgment sent back to client.
 * Silently ignores malformed or unrecognized messages.
 *
 * @param data - Raw string data from WebSocket message
 * @param getToolset - Function to retrieve BrowserToolsetLike for an agent
 * @param agentId - The agent ID this WebSocket connection is for
 */
export function handleInputMessage(
  data: string,
  getToolset: (agentId: string) => BrowserToolsetLike | undefined,
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

async function injectMouse(toolset: BrowserToolsetLike, msg: MouseInputMessage): Promise<void> {
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

async function injectKeyboard(toolset: BrowserToolsetLike, msg: KeyboardInputMessage): Promise<void> {
  await toolset.injectKeyboardEvent({
    type: msg.eventType,
    key: msg.key,
    code: msg.code,
    text: msg.text,
    modifiers: msg.modifiers,
  });
}
