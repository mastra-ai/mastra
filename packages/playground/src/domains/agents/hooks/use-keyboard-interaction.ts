import { useEffect, useRef } from 'react';
import { getModifiers } from '../utils/coordinate-mapping';
import { isPrintableKey } from '../utils/key-mapping';

interface UseKeyboardInteractionOptions {
  sendMessage: (data: string) => void;
  enabled: boolean;
  onEscape: () => void;
}

/**
 * Side-effect-only hook that captures keyboard events when interactive
 * mode is active and forwards them as CDP keyboard messages over WebSocket.
 *
 * Uses capture-phase document listeners to prevent keyboard events from
 * reaching host page handlers (chat input, Studio shortcuts).
 *
 * Printable characters: 3-event sequence (keyDown -> char -> keyUp)
 * Non-printable keys: 2-event sequence (keyDown -> keyUp)
 * IME composition: skipped during composition, final text sent on compositionend
 * Escape: consumed to exit interactive mode (not forwarded)
 */
export function useKeyboardInteraction(options: UseKeyboardInteractionOptions): void {
  // Store in refs so event handlers always read current values
  // without causing listener re-attachment
  const sendRef = useRef(options.sendMessage);
  const onEscapeRef = useRef(options.onEscape);

  useEffect(() => {
    sendRef.current = options.sendMessage;
  }, [options.sendMessage]);

  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  }, [options.onEscape]);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    // --- Helper: send a CDP keyboard input message ---
    function sendKeyboardMsg(
      eventType: 'keyDown' | 'keyUp' | 'char',
      key?: string,
      code?: string,
      text?: string,
      modifiers?: number,
    ): void {
      const msg: Record<string, unknown> = { type: 'keyboard', eventType };
      if (key !== undefined) msg.key = key;
      if (code !== undefined) msg.code = code;
      if (text !== undefined) msg.text = text;
      if (modifiers) msg.modifiers = modifiers;
      sendRef.current(JSON.stringify(msg));
    }

    // --- keydown: capture phase, forwards keyDown (+ char for printable) ---
    function handleKeyDown(e: KeyboardEvent): void {
      // Skip IME composition events
      if (e.isComposing || e.keyCode === 229) return;

      // Escape exits interactive mode -- consume, do NOT forward
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }

      // Prevent host page from receiving keyboard events
      e.preventDefault();
      e.stopPropagation();

      const modifiers = getModifiers(e);
      const isPrintable = isPrintableKey(e.key);

      // Send keyDown for all keys
      sendKeyboardMsg('keyDown', e.key, e.code, undefined, modifiers);

      // Printable characters also get a char event
      if (isPrintable) {
        sendKeyboardMsg('char', e.key, undefined, e.key, modifiers);
      }
    }

    // --- keyup: capture phase, forwards keyUp ---
    function handleKeyUp(e: KeyboardEvent): void {
      // Skip IME composition events
      if (e.isComposing || e.keyCode === 229) return;

      // Escape already handled in keydown -- skip
      if (e.key === 'Escape') return;

      // Prevent host page from receiving keyboard events
      e.preventDefault();
      e.stopPropagation();

      sendKeyboardMsg('keyUp', e.key, e.code, undefined, getModifiers(e));
    }

    // --- compositionend: bubble phase, sends composed text as key sequences ---
    function handleCompositionEnd(e: CompositionEvent): void {
      const text = e.data;
      if (!text) return;

      // Send each composed character as a full 3-event sequence
      for (const char of text) {
        sendKeyboardMsg('keyDown', char, undefined, undefined, 0);
        sendKeyboardMsg('char', char, undefined, char, 0);
        sendKeyboardMsg('keyUp', char, undefined, undefined, 0);
      }
    }

    // --- Attach event listeners ---
    // keydown/keyup use capture phase to intercept before host page handlers
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });
    // compositionend uses bubble phase (standard)
    document.addEventListener('compositionend', handleCompositionEnd);

    // --- Cleanup ---
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
      document.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [options.enabled]);
}
