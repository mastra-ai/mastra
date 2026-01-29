import type { BrowserToolsetLike } from '@mastra/core/agent';

/**
 * Status message sent to connected viewers.
 * Indicates the current state of the browser stream.
 */
export interface StatusMessage {
  status: 'connected' | 'browser_starting' | 'streaming' | 'browser_closed';
}

/**
 * Error message sent to connected viewers when something goes wrong.
 */
export interface ErrorMessage {
  error: 'browser_crashed' | 'screencast_failed' | 'auth_failed';
  message: string;
}

/**
 * Configuration for the browser stream WebSocket setup.
 */
export interface BrowserStreamConfig {
  /**
   * Function to retrieve the BrowserToolset for a given agent ID.
   * Returns undefined if no browser is available for this agent.
   */
  getToolset: (agentId: string) => BrowserToolsetLike | undefined;
}

/**
 * Mouse input message from client to server.
 * Client sends these when user interacts with the live view frame.
 */
export interface MouseInputMessage {
  type: 'mouse';
  /** CDP mouse event type */
  eventType: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
  /** X coordinate in browser viewport pixels */
  x: number;
  /** Y coordinate in browser viewport pixels */
  y: number;
  /** Mouse button */
  button?: 'left' | 'right' | 'middle' | 'none';
  /** Click count (1 for single, 2 for double) */
  clickCount?: number;
  /** Horizontal scroll delta (for mouseWheel) */
  deltaX?: number;
  /** Vertical scroll delta (for mouseWheel) */
  deltaY?: number;
  /** CDP modifier bitmask (1=Alt, 2=Ctrl, 4=Meta, 8=Shift) */
  modifiers?: number;
}

/**
 * Keyboard input message from client to server.
 * Client sends these when user types in the live view.
 */
export interface KeyboardInputMessage {
  type: 'keyboard';
  /** CDP keyboard event type */
  eventType: 'keyDown' | 'keyUp' | 'char';
  /** Key value (e.g., 'a', 'Enter', 'ArrowLeft') */
  key?: string;
  /** Physical key code (e.g., 'KeyA', 'Enter') */
  code?: string;
  /** Text to insert (for printable characters in 'char' events) */
  text?: string;
  /** CDP modifier bitmask (1=Alt, 2=Ctrl, 4=Meta, 8=Shift) */
  modifiers?: number;
}

/**
 * Union type for all client-to-server input messages.
 * Discriminated by the `type` field.
 */
export type ClientInputMessage = MouseInputMessage | KeyboardInputMessage;

/**
 * Viewport metadata message sent from server to client.
 * Sent on stream start and when viewport dimensions change.
 * Client uses this to map click coordinates from scaled frame to browser viewport.
 */
export interface ViewportMessage {
  viewport: {
    width: number;
    height: number;
  };
}
