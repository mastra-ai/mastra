# Phase 13: Focus Management and Keyboard - Research

**Researched:** 2026-01-29
**Domain:** Browser keyboard event capture, CDP keyboard injection, React focus management
**Confidence:** HIGH

## Summary

This phase implements keyboard input forwarding from the host page to the remote browser, gated by an explicit "interactive mode" that the user enters by clicking the live view frame. The implementation spans two concerns: (1) a focus management layer that captures/releases keyboard events and prevents them from leaking to the host page, and (2) a keyboard event translation layer that converts DOM `KeyboardEvent` objects into CDP `Input.dispatchKeyEvent` sequences sent over the existing WebSocket.

The infrastructure is already in place from prior phases. Phase 10 defined `KeyboardInputMessage` (with `type: 'keyboard'`, `eventType: 'keyDown' | 'keyUp' | 'char'`, `key`, `code`, `text`, `modifiers`). Phase 11 implemented server-side routing that calls `toolset.injectKeyboardEvent()` for each message. Phase 12 established the pattern with `useMouseInteraction` -- a side-effect-only hook that attaches DOM listeners, translates events to CDP messages, and sends them via `sendRef.current`. The keyboard hook follows the same architecture. The `getModifiers()` utility from `coordinate-mapping.ts` already computes the CDP modifier bitmask (Alt=1, Ctrl=2, Meta=4, Shift=8).

The key insight is that this phase adds a new concept -- interactive mode -- that did not exist in Phase 12. Mouse events fire whenever the cursor is over the image; keyboard events only fire when the user has explicitly clicked into the frame. This requires a state variable (`isInteractive`) managed in the `BrowserViewFrame` component that gates the keyboard hook and adds click-outside/Escape/blur listeners to exit interactive mode.

**Primary recommendation:** Create a `useKeyboardInteraction` hook following the same pattern as `useMouseInteraction`, plus an `isInteractive` state in `BrowserViewFrame` with click-to-enter, click-outside-to-exit, Escape-to-exit, and blur-to-exit behaviors. Use `event.key.length === 1` to discriminate printable from non-printable characters for CDP event sequence selection.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ (existing) | Component state for interactive mode, useEffect for listeners | Already in use |
| DOM KeyboardEvent API | Web standard | Source of key, code, isComposing properties | Browser-native, no library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No new dependencies | All infrastructure exists from Phases 10-12 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual click-outside detection | focus-trap-react library | Overkill -- we are not trapping Tab focus, just capturing keyboard events. Simple document click listener suffices |
| Manual key mapping | Puppeteer's USKeyboardLayout table | Unnecessary -- DOM KeyboardEvent already provides key, code. We do not need windowsVirtualKeyCode because the existing injectKeyboardEvent interface does not accept it and CDP char events work with just text |
| React onKeyDown props | Raw addEventListener in useEffect | Consistent with useMouseInteraction pattern; avoids React synthetic event overhead on hot path |

**Installation:**
```bash
# No new packages needed - all infrastructure exists from Phases 10-12
```

## Architecture Patterns

### Recommended Project Structure
```
packages/playground-ui/src/domains/agents/
  hooks/
    use-mouse-interaction.ts      # UNCHANGED (Phase 12)
    use-keyboard-interaction.ts   # CREATE: keyboard event handler hook
  utils/
    coordinate-mapping.ts         # UNCHANGED (getModifiers reused)
    key-mapping.ts                # CREATE: printable detection, CDP event helpers
  components/browser-view/
    browser-view-frame.tsx        # MODIFY: add interactive mode state, wire keyboard hook
```

### Pattern 1: Interactive Mode State Machine
**What:** A boolean `isInteractive` state in `BrowserViewFrame` that gates keyboard capture. The frame starts non-interactive. Clicking the frame enters interactive mode. Clicking outside, pressing Escape, or window blur exits it.
**When to use:** Always -- this is the core focus management requirement (FOCUS-01, FOCUS-02, FOCUS-03).

**Example:**
```typescript
// In BrowserViewFrame
const [isInteractive, setIsInteractive] = useState(false);

// Enter interactive mode on frame click
const handleFrameClick = useCallback(() => {
  setIsInteractive(true);
}, []);

// Exit interactive mode
const exitInteractive = useCallback(() => {
  setIsInteractive(false);
}, []);

// Click-outside detection: mousedown on document
useEffect(() => {
  if (!isInteractive) return;

  function handleDocumentMouseDown(e: MouseEvent) {
    // If click is outside the frame container, exit
    const container = containerRef.current;
    if (container && !container.contains(e.target as Node)) {
      setIsInteractive(false);
    }
  }

  // Window blur exits interactive mode
  function handleWindowBlur() {
    setIsInteractive(false);
  }

  document.addEventListener('mousedown', handleDocumentMouseDown);
  window.addEventListener('blur', handleWindowBlur);

  return () => {
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    window.removeEventListener('blur', handleWindowBlur);
  };
}, [isInteractive]);
```

### Pattern 2: Keyboard Hook (mirrors useMouseInteraction)
**What:** A `useKeyboardInteraction` hook that attaches `keydown` and `keyup` listeners to the document when interactive mode is active, translates DOM KeyboardEvents to CDP keyboard messages, and sends them over the WebSocket.
**When to use:** Always -- follows established hook pattern from Phase 12.

**Example:**
```typescript
// Source: pattern derived from existing useMouseInteraction
export function useKeyboardInteraction(options: UseKeyboardInteractionOptions): void {
  const sendRef = useRef(options.sendMessage);

  useEffect(() => {
    sendRef.current = options.sendMessage;
  }, [options.sendMessage]);

  useEffect(() => {
    if (!options.enabled) return;

    function handleKeyDown(e: KeyboardEvent): void {
      // Skip IME composition events
      if (e.isComposing || e.keyCode === 229) return;

      // Escape exits interactive mode (consumed, not forwarded)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        options.onEscape?.();
        return;
      }

      // Prevent host page from receiving this event
      e.preventDefault();
      e.stopPropagation();

      const modifiers = getModifiers(e);
      const isPrintable = e.key.length === 1;

      if (isPrintable) {
        // 3-event sequence: keyDown -> char -> keyUp
        sendKeyboardEvent(sendRef, 'keyDown', e.key, e.code, undefined, modifiers);
        sendKeyboardEvent(sendRef, 'char', e.key, undefined, e.key, modifiers);
      } else {
        // 2-event sequence: keyDown (keyUp sent in handleKeyUp)
        sendKeyboardEvent(sendRef, 'keyDown', e.key, e.code, undefined, modifiers);
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') return; // Already handled in keyDown

      e.preventDefault();
      e.stopPropagation();

      sendKeyboardEvent(sendRef, 'keyUp', e.key, e.code, undefined, getModifiers(e));
    }

    // Attach to document to capture all keyboard events
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [options.enabled, options.onEscape]);
}
```

### Pattern 3: Capture Phase Event Listeners
**What:** Attach keyboard listeners with `{ capture: true }` and call `e.stopPropagation()` + `e.preventDefault()` to prevent events from reaching host page handlers.
**When to use:** Always in interactive mode -- this is how FOCUS-03 (no event leaking) is satisfied.
**Why:** Capture phase runs before bubble phase. By stopping propagation in capture, no other listener on the page (chat input, Studio shortcuts) receives the event.

### Pattern 4: CDP Keyboard Event Sequence Construction
**What:** The client constructs multi-event CDP sequences. Printable characters get 3 events (keyDown, char, keyUp). Non-printable keys get 2 events (keyDown, keyUp).
**When to use:** For every keyboard event forwarded to the browser.

**Key Mapping Logic:**
```typescript
// Source: CDP Input.dispatchKeyEvent spec + Puppeteer implementation pattern
function sendKeyboardEvent(
  sendRef: React.RefObject<(data: string) => void>,
  eventType: 'keyDown' | 'keyUp' | 'char',
  key: string | undefined,
  code: string | undefined,
  text: string | undefined,
  modifiers: number,
): void {
  const msg: Record<string, unknown> = { type: 'keyboard', eventType };
  if (key !== undefined) msg.key = key;
  if (code !== undefined) msg.code = code;
  if (text !== undefined) msg.text = text;
  if (modifiers) msg.modifiers = modifiers;
  sendRef.current(JSON.stringify(msg));
}
```

**Printable character 'a' produces:**
1. `{ type: 'keyboard', eventType: 'keyDown', key: 'a', code: 'KeyA', modifiers: 0 }`
2. `{ type: 'keyboard', eventType: 'char', key: 'a', text: 'a', modifiers: 0 }`
3. `{ type: 'keyboard', eventType: 'keyUp', key: 'a', code: 'KeyA', modifiers: 0 }`

**Non-printable 'Enter' produces:**
1. `{ type: 'keyboard', eventType: 'keyDown', key: 'Enter', code: 'Enter', modifiers: 0 }`
2. `{ type: 'keyboard', eventType: 'keyUp', key: 'Enter', code: 'Enter', modifiers: 0 }`

### Pattern 5: Modifier Key State Tracking
**What:** Track which modifier keys are currently held down to include the correct CDP bitmask in every event. The existing `getModifiers()` utility from `coordinate-mapping.ts` already does this by reading `event.altKey`, `event.ctrlKey`, `event.metaKey`, `event.shiftKey` from each DOM KeyboardEvent.
**When to use:** Every keyboard event.
**Why:** CDP modifier bitmask (Alt=1, Ctrl=2, Meta=4, Shift=8) must reflect which modifiers are held at the time of each event. DOM KeyboardEvent already provides this state on every event -- no manual tracking needed.

### Pattern 6: IME Composition Handling
**What:** Skip keyboard event forwarding during IME composition sessions.
**When to use:** When `event.isComposing === true` or `event.keyCode === 229`.
**Why:** During IME composition (CJK input), the browser fires keydown events with `isComposing: true` and `keyCode: 229`. These intermediate events should not be forwarded as individual key presses. Instead, wait for `compositionend` and forward the final composed text.

**IME handling approach:**
```typescript
// Listen for compositionend to get final composed text
function handleCompositionEnd(e: CompositionEvent): void {
  const composedText = e.data;
  if (!composedText) return;

  // Send each character of composed text as individual char events
  for (const char of composedText) {
    sendKeyboardEvent(sendRef, 'keyDown', char, undefined, undefined, 0);
    sendKeyboardEvent(sendRef, 'char', char, undefined, char, 0);
    sendKeyboardEvent(sendRef, 'keyUp', char, undefined, undefined, 0);
  }
}
```

### Anti-Patterns to Avoid
- **Using `event.code` instead of `event.key` for text input:** `event.code` is the physical key position (e.g., 'KeyA' regardless of keyboard layout). `event.key` is the layout-aware value (e.g., 'a' on US, 'q' on French AZERTY). CONTEXT.md explicitly requires using `KeyboardEvent.key`.
- **Forwarding Escape to the browser:** Escape is reserved for exiting interactive mode. It must be consumed, not forwarded (locked decision).
- **Using React synthetic event props (onKeyDown) for the hook:** Inconsistent with useMouseInteraction pattern. Raw addEventListener in useEffect is the established approach.
- **Building a windowsVirtualKeyCode lookup table:** The existing `injectKeyboardEvent` interface does not accept `windowsVirtualKeyCode`. The server passes through `{ type, key, code, text, modifiers }` to CDP. For printable characters, the `text` field on `char` events drives text insertion. For non-printable keys, `key` and `code` are sufficient in modern Chromium.
- **Trapping Tab focus within the frame:** We are NOT building a focus trap. Tab is forwarded to the browser (locked decision). The user's focus stays on the document; we just capture keyboard events globally in capture phase.
- **Attaching keyboard listeners to the img element:** The img element cannot receive keyboard focus. Listeners must be on `document` (capture phase) when interactive mode is active.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modifier bitmask calculation | Custom modifier tracking | Existing `getModifiers()` from coordinate-mapping.ts | Already handles Alt=1, Ctrl=2, Meta=4, Shift=8 bitmask |
| Printable character detection | Lookup table of non-printable key names | `event.key.length === 1` check | Simple, standard approach. Key names for non-printable keys are always multi-character ('Enter', 'ArrowLeft', etc.) |
| Click-outside detection | focus-trap library | Simple `document.addEventListener('mousedown')` with `container.contains()` | Standard pattern, no library needed for this use case |
| CDP message construction | Custom message protocol | Existing `KeyboardInputMessage` type from types.ts | Already defined in Phase 10 with correct shape |
| WebSocket transport | Custom WebSocket | Existing `sendMessage` from `useBrowserStream` | Already wired in Phase 12 |

**Key insight:** Phase 13 adds a new _gating layer_ (interactive mode) and a new _event translation_ (keyboard -> CDP), but all transport, server routing, and CDP injection infrastructure already exists. The work is purely client-side: state management for interactive mode and a keyboard event hook.

## Common Pitfalls

### Pitfall 1: Keyboard Events Leaking to Host Page
**What goes wrong:** User types in interactive mode but characters also appear in the chat input, or Studio shortcuts fire.
**Why it happens:** Using bubble-phase listeners or forgetting `e.stopPropagation()` and `e.preventDefault()`.
**How to avoid:** Use capture phase (`{ capture: true }`) on document-level listeners. Call both `e.preventDefault()` and `e.stopPropagation()` on every handled event.
**Warning signs:** Chat input receives characters when user is typing in the live view.

### Pitfall 2: Escape Not Exiting Interactive Mode
**What goes wrong:** User presses Escape but stays in interactive mode, or Escape is forwarded to the browser.
**Why it happens:** Escape handling happens in the wrong order -- forwarded before the exit check runs.
**How to avoid:** Check for Escape as the FIRST thing in the keydown handler, before any forwarding logic. Call `onEscape()` callback and return immediately.
**Warning signs:** Escape closes a dialog in the remote browser instead of exiting interactive mode.

### Pitfall 3: IME Events Forwarded as Individual Keystrokes
**What goes wrong:** Chinese/Japanese input sends partial keystrokes instead of composed characters, resulting in garbage text in the remote browser.
**Why it happens:** Not checking `event.isComposing` or `event.keyCode === 229` before forwarding.
**How to avoid:** Guard both keydown and keyup handlers with `if (e.isComposing || e.keyCode === 229) return;`. Handle final text via `compositionend` event.
**Warning signs:** CJK input produces random Latin characters in the remote browser input field.

### Pitfall 4: Interactive Mode Not Resetting on Window Blur
**What goes wrong:** User switches tabs, comes back, and keyboard events are still captured by the live view without re-clicking.
**Why it happens:** Missing `window.addEventListener('blur', ...)` listener.
**How to avoid:** Add window blur handler that sets `isInteractive(false)`. This is a locked decision from CONTEXT.md.
**Warning signs:** Keyboard capture persists after Alt+Tab.

### Pitfall 5: Click-Outside Listener Interfering with Frame Click
**What goes wrong:** Clicking the frame to enter interactive mode immediately triggers the click-outside handler and exits.
**Why it happens:** The mousedown handler on document fires before or simultaneously with the frame click handler.
**How to avoid:** Use `mousedown` (not `click`) for the outside listener, and check `container.contains(e.target)` to exclude clicks inside the frame. The frame click handler calls `setIsInteractive(true)` which runs synchronously before the outside handler's `contains()` check resolves.
**Warning signs:** Cannot enter interactive mode -- clicking the frame immediately exits.

### Pitfall 6: Modifier-Only Keys Generating Spurious CDP Events
**What goes wrong:** Pressing Shift alone sends a keyDown/keyUp to CDP that the browser interprets as a shortcut or selection gesture.
**Why it happens:** Modifier keys (Shift, Control, Alt, Meta) generate keydown/keyup events. If forwarded naively, the remote browser receives standalone modifier presses.
**How to avoid:** Forward modifier key events -- they are legitimate (e.g., Shift+click for selection, holding Ctrl for multi-select). The remote browser handles standalone modifiers gracefully. However, do NOT send a `char` event for modifier keys (they are non-printable, `event.key.length > 1`).
**Warning signs:** N/A -- this is correct behavior but worth documenting.

### Pitfall 7: Sending char Event with text for Non-Printable Keys
**What goes wrong:** A `char` event with `text: '\r'` is sent for Enter key, which is wrong for the 2-event sequence.
**Why it happens:** Some CDP references show Enter having `text: '\r'` -- but that is for the Puppeteer `keyDown` approach where type is `keyDown` (not `rawKeyDown`). Our interface uses the simpler `keyDown` + `keyUp` sequence for non-printable keys without a `char` event.
**How to avoid:** The `event.key.length === 1` check correctly identifies Enter ('Enter'.length > 1) as non-printable, so it gets the 2-event sequence without `char`.
**Warning signs:** Enter key inserts a carriage return character instead of submitting a form.

## Code Examples

### Complete useKeyboardInteraction Hook

```typescript
// Source: synthesized from existing useMouseInteraction pattern + CDP keyboard spec
import { useEffect, useRef } from 'react';
import { getModifiers } from '../utils/coordinate-mapping';

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
 */
export function useKeyboardInteraction(options: UseKeyboardInteractionOptions): void {
  const sendRef = useRef(options.sendMessage);
  const onEscapeRef = useRef(options.onEscape);

  useEffect(() => {
    sendRef.current = options.sendMessage;
  }, [options.sendMessage]);

  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  }, [options.onEscape]);

  useEffect(() => {
    if (!options.enabled) return;

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

    function handleKeyDown(e: KeyboardEvent): void {
      // Skip IME composition events
      if (e.isComposing || e.keyCode === 229) return;

      // Escape exits interactive mode (consumed, not forwarded)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const modifiers = getModifiers(e);
      const isPrintable = e.key.length === 1;

      // keyDown event (always sent)
      sendKeyboardMsg('keyDown', e.key, e.code, undefined, modifiers);

      // char event (only for printable characters)
      if (isPrintable) {
        sendKeyboardMsg('char', e.key, undefined, e.key, modifiers);
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') return;

      e.preventDefault();
      e.stopPropagation();

      sendKeyboardMsg('keyUp', e.key, e.code, undefined, getModifiers(e));
    }

    function handleCompositionEnd(e: CompositionEvent): void {
      const text = e.data;
      if (!text) return;

      // Forward each composed character as a full key sequence
      for (const char of text) {
        sendKeyboardMsg('keyDown', char, undefined, undefined, 0);
        sendKeyboardMsg('char', char, undefined, char, 0);
        sendKeyboardMsg('keyUp', char, undefined, undefined, 0);
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });
    document.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
      document.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [options.enabled]);
}
```

### Interactive Mode State in BrowserViewFrame

```typescript
// Source: modification to existing browser-view-frame.tsx
const [isInteractive, setIsInteractive] = useState(false);
const containerRef = useRef<HTMLDivElement>(null);

// Enter interactive mode on click
const handleFrameClick = useCallback(() => {
  if (status === 'streaming') {
    setIsInteractive(true);
  }
}, [status]);

// Exit interactive mode
const exitInteractive = useCallback(() => {
  setIsInteractive(false);
}, []);

// Click-outside and window blur handlers
useEffect(() => {
  if (!isInteractive) return;

  function handleDocumentMouseDown(e: MouseEvent) {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsInteractive(false);
    }
  }

  function handleWindowBlur() {
    setIsInteractive(false);
  }

  document.addEventListener('mousedown', handleDocumentMouseDown);
  window.addEventListener('blur', handleWindowBlur);

  return () => {
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    window.removeEventListener('blur', handleWindowBlur);
  };
}, [isInteractive]);

// Wire keyboard hook
useKeyboardInteraction({
  sendMessage,
  enabled: isInteractive,
  onEscape: exitInteractive,
});
```

### Key Mapping Utility

```typescript
// Source: pure utility for key-mapping.ts
/**
 * Determine if a KeyboardEvent.key value represents a printable character.
 *
 * Printable characters have key.length === 1 (single Unicode character).
 * Non-printable keys have multi-character names: 'Enter', 'ArrowLeft', 'Shift', etc.
 * Dead keys return 'Dead' (length > 1, correctly treated as non-printable).
 */
export function isPrintableKey(key: string): boolean {
  return key.length === 1;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `event.keyCode` ranges for printable detection | `event.key.length === 1` | keyCode deprecated, key property standardized | Simpler, layout-aware |
| `event.keyCode` for key identification | `event.key` + `event.code` | keyCode deprecated | Layout-aware key values |
| rawKeyDown + windowsVirtualKeyCode | keyDown with text field | Puppeteer pattern, modern Chromium | Simpler CDP calls, text drives insertion |
| Manual modifier tracking across events | Read from each KeyboardEvent | DOM always includes altKey/ctrlKey/metaKey/shiftKey | No state management needed |

**Deprecated/outdated:**
- `event.keyCode` / `event.charCode` / `event.which`: All deprecated. Use `event.key` and `event.code` instead.
- `rawKeyDown` CDP type: Still supported but `keyDown` is sufficient when text is provided. Puppeteer uses `keyDown` when text exists.

## Open Questions

1. **windowsVirtualKeyCode for non-printable keys**
   - What we know: The existing `injectKeyboardEvent` interface only accepts `{ type, key, code, text, modifiers }`. It does NOT include `windowsVirtualKeyCode`. Some CDP documentation suggests `windowsVirtualKeyCode` is practically important for non-printable keys.
   - What's unclear: Whether the current interface causes issues with keys like Enter, Tab, Backspace in the remote browser.
   - Recommendation: Proceed with the existing interface. The `key` and `code` fields should be sufficient for modern Chromium. If issues arise with specific keys, the interface can be extended later. This is a validation task, not a blocker. Confidence: MEDIUM.

2. **Dead key composition**
   - What we know: Dead keys (for accented characters like e + accent -> e) produce a `key` value of `'Dead'` on the first keystroke, then the composed character on the second. `'Dead'.length > 1` so it would be treated as non-printable.
   - What's unclear: Whether forwarding `keyDown` with `key: 'Dead'` to CDP correctly starts composition in the remote browser.
   - Recommendation: Forward dead key events as-is (2-event non-printable sequence). If CDP does not handle dead keys natively, this can be addressed in a follow-up. Mark as Claude's discretion area. Confidence: LOW.

3. **Function key forwarding policy**
   - What we know: Claude's discretion per CONTEXT.md. Function keys (F1-F12) are non-printable and would naturally flow through the 2-event sequence.
   - What's unclear: Whether forwarding F1 (help) or F5 (refresh) causes unwanted browser behavior.
   - Recommendation: Forward all function keys F1-F12 to the browser. The remote browser handles them as expected (F1 opens help, F5 refreshes). Prevent the host browser's default for these keys via `e.preventDefault()`. Confidence: HIGH.

4. **Browser chrome shortcuts (Ctrl+L, Ctrl+F)**
   - What we know: Claude's discretion. These shortcuts open browser chrome features (address bar, find) that may not work in a headless/CDP-controlled browser.
   - What's unclear: Whether CDP correctly handles these shortcuts.
   - Recommendation: Forward all modifier combinations to the browser (locked decision: "Only Escape is reserved"). The remote browser handles them. If the remote browser is headless, chrome shortcuts are no-ops. Confidence: MEDIUM.

## Sources

### Primary (HIGH confidence)
- `/packages/playground-ui/src/domains/agents/hooks/use-mouse-interaction.ts` -- Existing hook pattern to follow
- `/packages/playground-ui/src/domains/agents/utils/coordinate-mapping.ts` -- `getModifiers()` utility to reuse
- `/packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` -- Component to modify
- `/packages/deployer/src/server/browser-stream/types.ts` -- `KeyboardInputMessage` type definition
- `/packages/deployer/src/server/browser-stream/input-handler.ts` -- Server-side keyboard routing (already implemented)
- `/packages/core/src/agent/types.ts` lines 120-126 -- `injectKeyboardEvent` interface
- [CDP Input.dispatchKeyEvent spec](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- Parameter reference
- [MDN KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) -- Key property documentation
- [MDN KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing) -- IME composition detection
- [MDN Element: keydown event](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event) -- isComposing and keyCode 229 guidance

### Secondary (MEDIUM confidence)
- [Puppeteer CdpKeyboard implementation](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/cdp/Input.ts) -- Reference for CDP keyboard event construction
- [Puppeteer USKeyboardLayout](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/common/USKeyboardLayout.ts) -- Key definition structure reference
- [CDP dispatchKeyEvent GitHub issue #52](https://github.com/mafredri/cdp/issues/52) -- keyDown/char/keyUp sequence verification
- [CDP Enter key issue #45](https://github.com/ChromeDevTools/devtools-protocol/issues/45) -- Non-printable key event sequence
- [focus-trap-react](https://github.com/focus-trap/focus-trap-react) -- Focus trapping patterns (decided against using)
- [React composition events issue #8683](https://github.com/facebook/react/issues/8683) -- IME handling in React

### Tertiary (LOW confidence)
- WebSearch results on dead key handling via CDP -- Limited documentation available
- WebSearch results on windowsVirtualKeyCode necessity -- Conflicting information across sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries; all infrastructure verified in codebase
- Architecture: HIGH -- Follows established useMouseInteraction pattern; interactive mode state is standard React useState
- Key mapping: HIGH -- `event.key.length === 1` for printable detection is well-documented and standardized
- CDP event sequences: HIGH -- 3-event printable / 2-event non-printable verified across multiple sources (Puppeteer, CDP spec, chromedp)
- IME handling: MEDIUM -- Pattern is well-documented but edge cases in composition event ordering vary by browser
- Pitfalls: HIGH -- All derived from verified code patterns and DOM event specifications
- windowsVirtualKeyCode gap: MEDIUM -- Current interface may be insufficient for some non-printable keys, but untested

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (stable domain -- DOM keyboard events and CDP keyboard protocol are mature specs)
