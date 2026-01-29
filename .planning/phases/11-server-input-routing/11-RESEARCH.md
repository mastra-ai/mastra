# Phase 11: Server Input Routing - Research

**Researched:** 2026-01-29
**Domain:** WebSocket message handling, CDP input injection routing, JSON validation
**Confidence:** HIGH

## Summary

This phase implements the server-side `onMessage` WebSocket handler that receives client input messages (mouse and keyboard events) and routes them to the appropriate CDP injection methods on `BrowserToolsetLike`. The infrastructure is already in place from prior phases: Phase 10 defined `ClientInputMessage` (discriminated union of `MouseInputMessage | KeyboardInputMessage`), extended `BrowserToolsetLike` with `injectMouseEvent()` and `injectKeyboardEvent()`, and the WebSocket route in `browser-stream.ts` has a placeholder `onMessage` handler awaiting implementation.

The implementation is straightforward: parse incoming WebSocket text messages as JSON, validate the structure matches `ClientInputMessage`, discriminate on the `type` field (`'mouse'` vs `'keyboard'`), extract the CDP event parameters, and call the corresponding `toolset.inject*()` method. All injection is fire-and-forget -- no acknowledgment is sent back. Malformed messages are silently discarded. The server does NOT build multi-event sequences (like 3-event click); it passes through individual events that the client sends one at a time. The client (Phases 12 and 13) is responsible for sending the correct CDP event sequences.

**Primary recommendation:** Implement the `onMessage` handler in `browser-stream.ts` with JSON parse + type-discriminated routing to `config.getToolset(agentId).inject*()`, using `void` for fire-and-forget. Add a lightweight `isValidInputMessage()` validation function in a new `input-handler.ts` module to keep `browser-stream.ts` focused on WebSocket lifecycle.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | 4.11.3 | WebSocket framework (already integrated) | Existing project dependency, provides WSContext and onMessage handler |
| @hono/node-ws | ^1.3.0 | WebSocket adapter (already integrated) | Already wired in setupBrowserStream |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No new dependencies needed | All types and infrastructure already exist |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual JSON validation | Zod runtime parsing | Overkill for 2 message types; adds latency to hot path |
| Inline validation | Type guard functions | Type guards are cleaner and reusable |

**Installation:**
```bash
# No new packages needed - all infrastructure exists from Phases 8 and 10
```

## Architecture Patterns

### Recommended Module Structure
```
packages/deployer/src/server/browser-stream/
├── browser-stream.ts     # MODIFY: wire onMessage to input handler
├── input-handler.ts      # CREATE: message parsing, validation, routing
├── viewer-registry.ts    # UNCHANGED
├── types.ts              # UNCHANGED (ClientInputMessage already defined)
└── index.ts              # MODIFY: export input handler if needed
```

### Pattern 1: Separate Input Handler Module
**What:** Extract message parsing, validation, and routing into a dedicated `input-handler.ts` module rather than inlining in the `onMessage` callback.
**When to use:** Always -- keeps the WebSocket route file focused on connection lifecycle.
**Why:** The `browser-stream.ts` file handles connection lifecycle (onOpen/onClose/onError). Input handling is a distinct concern with its own validation logic. Separating them makes each file single-purpose and easier to test.

**Example:**
```typescript
// input-handler.ts
import type { BrowserToolsetLike } from '@mastra/core/agent';
import type { ClientInputMessage, MouseInputMessage, KeyboardInputMessage } from './types.js';

/**
 * Handle an incoming WebSocket message by routing to the appropriate
 * toolset injection method. Fire-and-forget: no acknowledgment sent.
 * Silently ignores malformed messages.
 */
export function handleInputMessage(
  data: string,
  getToolset: (agentId: string) => BrowserToolsetLike | undefined,
  agentId: string,
): void {
  // Parse JSON -- silently ignore non-JSON
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return; // Malformed JSON -- silent ignore
  }

  // Validate message structure
  if (!isValidInputMessage(message)) {
    return; // Invalid structure -- silent ignore
  }

  // Get toolset for this agent
  const toolset = getToolset(agentId);
  if (!toolset) {
    return; // No browser available -- silent ignore
  }

  // Route based on discriminated type field
  switch (message.type) {
    case 'mouse':
      void routeMouseEvent(toolset, message);
      break;
    case 'keyboard':
      void routeKeyboardEvent(toolset, message);
      break;
  }
}
```

### Pattern 2: Type Guard Validation (not Zod)
**What:** Use TypeScript type guard functions for runtime validation rather than Zod schema parsing.
**When to use:** When validating a small number of known message shapes on a hot path where latency matters.
**Why:** Zod adds overhead per parse. For 2 message types with known shapes, hand-written type guards are faster and have zero dependencies. Input events can fire at 60+ Hz for mouse moves.

**Example:**
```typescript
function isValidInputMessage(msg: unknown): msg is ClientInputMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;

  if (obj.type === 'mouse') return isValidMouseMessage(obj);
  if (obj.type === 'keyboard') return isValidKeyboardMessage(obj);
  return false;
}

function isValidMouseMessage(obj: Record<string, unknown>): obj is MouseInputMessage {
  return (
    typeof obj.eventType === 'string' &&
    ['mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel'].includes(obj.eventType) &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    isFinite(obj.x) &&
    isFinite(obj.y) &&
    obj.x >= 0 &&
    obj.y >= 0
  );
}

function isValidKeyboardMessage(obj: Record<string, unknown>): obj is KeyboardInputMessage {
  return (
    typeof obj.eventType === 'string' &&
    ['keyDown', 'keyUp', 'char'].includes(obj.eventType)
  );
}
```

### Pattern 3: Fire-and-Forget with void
**What:** Use the `void` operator to call async inject methods without awaiting.
**When to use:** For all input injection calls in `onMessage`. This is the same pattern already used in `onOpen` (see `void registry.addViewer(...)` in `browser-stream.ts`).
**Why:** ROUTE-03 requires no acknowledgment latency. Awaiting would block the onMessage handler and delay processing of subsequent events.

**Example:**
```typescript
// In onMessage handler:
void handleInputMessage(dataString, config.getToolset, agentId);
```

### Pattern 4: Extract Event Parameters for CDP
**What:** Map `ClientInputMessage` fields to the CDP inject method parameter shapes.
**When to use:** When routing mouse and keyboard messages to toolset inject methods.
**Why:** `MouseInputMessage` has `type: 'mouse'` and `eventType: 'mousePressed'`, but `injectMouseEvent()` expects `type: 'mousePressed'`. The server must map `eventType` to the CDP `type` parameter.

**Example:**
```typescript
async function routeMouseEvent(
  toolset: BrowserToolsetLike,
  msg: MouseInputMessage,
): Promise<void> {
  await toolset.injectMouseEvent({
    type: msg.eventType,    // Map eventType -> CDP type
    x: msg.x,
    y: msg.y,
    button: msg.button,
    clickCount: msg.clickCount,
    deltaX: msg.deltaX,
    deltaY: msg.deltaY,
    modifiers: msg.modifiers,
  });
}

async function routeKeyboardEvent(
  toolset: BrowserToolsetLike,
  msg: KeyboardInputMessage,
): Promise<void> {
  await toolset.injectKeyboardEvent({
    type: msg.eventType,    // Map eventType -> CDP type
    key: msg.key,
    code: msg.code,
    text: msg.text,
    modifiers: msg.modifiers,
  });
}
```

### Anti-Patterns to Avoid
- **Building multi-event sequences on the server:** The server does NOT construct 3-event click sequences or 3-event keyboard sequences. That is the client's responsibility (Phase 12 for mouse, Phase 13 for keyboard). The server routes individual events.
- **Awaiting injection in onMessage:** Blocks the WebSocket message pump. Use `void` for fire-and-forget.
- **Using Zod for hot-path validation:** Adds unnecessary latency for 2 simple message types.
- **Sending acknowledgment messages:** ROUTE-03 explicitly forbids acknowledgment latency.
- **Throwing errors on malformed messages:** ROUTE-02 requires silent discard. No error messages sent back.
- **Logging every input event:** Mouse events can fire at 60+ Hz. Logging each one floods the console. At most, log errors from injection failures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message type definitions | New types | Existing `ClientInputMessage` from types.ts | Already defined in Phase 10 |
| CDP injection | Direct CDP calls | `BrowserToolsetLike.injectMouseEvent/injectKeyboardEvent` | Already abstracted in Phase 7/10 |
| Toolset lookup | Custom registry | `config.getToolset(agentId)` | Already in BrowserStreamConfig |
| WebSocket handler | Custom server | Hono `upgradeWebSocket` onMessage | Already wired from Phase 8 |

**Key insight:** Phase 11 is pure glue code. Every building block already exists. The work is wiring the `onMessage` placeholder to call existing inject methods via existing types through existing config.

## Common Pitfalls

### Pitfall 1: Confusing Server Routing with Client Event Sequences
**What goes wrong:** Implementing 3-event click logic in the server, duplicating work meant for Phase 12.
**Why it happens:** Success criteria #3 and #4 describe the end-to-end result ("Mouse input messages call injectMouseEvent with complete 3-event sequence"), but the 3-event sequence is composed by the CLIENT. The server receives and routes individual events.
**How to avoid:** The server handles one message at a time. Each message maps to exactly one `inject*()` call. The client sends multiple messages for a click (mouseMoved, mousePressed, mouseReleased).
**Warning signs:** Server code that checks for "click" as a message type or batches multiple inject calls per message.

### Pitfall 2: Blocking onMessage with await
**What goes wrong:** Slow injection (browser not ready, CDP timeout) blocks all subsequent WebSocket messages for this connection.
**Why it happens:** Using `await toolset.injectMouseEvent(...)` in the synchronous onMessage callback.
**How to avoid:** Use `void routeMouseEvent(toolset, msg)` -- fire-and-forget.
**Warning signs:** Input feels laggy because each event waits for CDP round-trip before next event processes.

### Pitfall 3: MessageEvent.data Type Confusion
**What goes wrong:** Trying to call `JSON.parse(event.data)` when `event.data` might be a Blob or ArrayBuffer.
**Why it happens:** Hono's `WSMessageReceive` type is `string | Blob | ArrayBufferLike`. The client sends text messages (JSON), but the type system doesn't know that.
**How to avoid:** Check `typeof event.data === 'string'` before parsing, or convert to string. Since input messages are always JSON text, reject non-string data early.
**Warning signs:** `JSON.parse` throwing on binary data, or TypeScript errors about the data type.

### Pitfall 4: Not Handling Missing Toolset Gracefully
**What goes wrong:** Server throws unhandled exception when `getToolset(agentId)` returns `undefined`.
**Why it happens:** Agent might not have a browser configured, or browser was closed.
**How to avoid:** Check for null/undefined toolset before attempting injection. Silent discard per ROUTE-02.
**Warning signs:** Unhandled promise rejections in server logs when clicking on a non-browser agent's view.

### Pitfall 5: Coordinate Validation Not Catching NaN/Infinity
**What goes wrong:** CDP receives NaN or Infinity coordinates, causing unpredictable behavior.
**Why it happens:** Client bug sends bad coordinates; simple `typeof === 'number'` passes for NaN.
**How to avoid:** Use `isFinite(x)` and `x >= 0` checks, not just `typeof`.
**Warning signs:** Mouse events going to coordinate (0,0) or causing CDP errors.

### Pitfall 6: Injection Error Crashes Server
**What goes wrong:** `injectMouseEvent` throws (browser closed, CDP disconnected), unhandled rejection crashes process.
**Why it happens:** Fire-and-forget `void` doesn't catch promise rejections.
**How to avoid:** The route functions should have try/catch and log errors. Or use `.catch(err => console.warn(...))` on the void promise.
**Warning signs:** UnhandledPromiseRejection warnings in Node.js.

## Code Examples

### Complete onMessage Handler (browser-stream.ts modification)

```typescript
// Source: existing browser-stream.ts onMessage placeholder
// BEFORE:
onMessage(_event, _ws) {
  // Future: handle input events for Phase 10+ (mouse/keyboard injection)
},

// AFTER:
onMessage(event, _ws) {
  // Route input events to CDP injection (fire-and-forget, no ack)
  const data = typeof event.data === 'string'
    ? event.data
    : null;
  if (data) {
    handleInputMessage(data, config.getToolset, agentId);
  }
},
```

### Complete input-handler.ts Module

```typescript
// Source: synthesized from existing types.ts and toolset signatures
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

const VALID_MOUSE_EVENTS = new Set([
  'mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel',
]);

function isValidMouseMessage(obj: Record<string, unknown>): obj is MouseInputMessage {
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

function isValidKeyboardMessage(obj: Record<string, unknown>): obj is KeyboardInputMessage {
  return (
    typeof obj.eventType === 'string' &&
    VALID_KEYBOARD_EVENTS.has(obj.eventType)
  );
}

// --- Injection ---

async function injectMouse(
  toolset: BrowserToolsetLike,
  msg: MouseInputMessage,
): Promise<void> {
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

async function injectKeyboard(
  toolset: BrowserToolsetLike,
  msg: KeyboardInputMessage,
): Promise<void> {
  await toolset.injectKeyboardEvent({
    type: msg.eventType,
    key: msg.key,
    code: msg.code,
    text: msg.text,
    modifiers: msg.modifiers,
  });
}
```

### Field Mapping Reference

The `ClientInputMessage` types (defined in Phase 10) use a two-level type discrimination:
- `type` field: `'mouse'` | `'keyboard'` -- for server routing
- `eventType` field: CDP event subtype -- passed as `type` to CDP inject methods

```
ClientInputMessage.type     -> routing decision (switch statement)
ClientInputMessage.eventType -> toolset.inject*({ type: eventType, ... })
```

This is critical: `msg.type` is the discriminant for routing, `msg.eventType` becomes the CDP `type` parameter.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder onMessage | Input routing handler | This phase | Enables mouse/keyboard interaction |
| No input validation | Type guard validation | This phase | Prevents malformed CDP calls |

**Deprecated/outdated:**
- None -- this is new functionality

## Open Questions

1. **Coordinate upper bound validation**
   - What we know: Coordinates must be >= 0 (validated). The client maps to viewport coordinates.
   - What's unclear: Should the server also validate against the last known viewport dimensions (e.g., x < viewport.width)?
   - Recommendation: Do NOT validate upper bounds on server. The server does not reliably know the current viewport at message time (viewport metadata is tracked for broadcasting, not for input validation). CDP will handle out-of-range coordinates gracefully. Keep validation minimal: >= 0, isFinite.

2. **Error handling granularity**
   - What we know: ROUTE-02 says silently ignore malformed messages. ROUTE-03 says fire-and-forget.
   - What's unclear: Should injection errors (CDP failures) be logged or also silent?
   - Recommendation: Log injection errors with `console.warn` -- these indicate real problems (browser crashed, CDP disconnected) vs. malformed input (client bug). Use `.catch()` on the void promise.

3. **Rate limiting mouse events**
   - What we know: Mouse move events can fire at display refresh rate (60+ Hz).
   - What's unclear: Should the server throttle or debounce mouseMoved events?
   - Recommendation: Do NOT throttle on the server in Phase 11. The client (Phase 12) should throttle before sending. Server should be a dumb pipe. If performance issues arise, throttling can be added later without API changes.

## Sources

### Primary (HIGH confidence)
- `/packages/deployer/src/server/browser-stream/browser-stream.ts` - Current onMessage placeholder, existing patterns
- `/packages/deployer/src/server/browser-stream/types.ts` - ClientInputMessage, MouseInputMessage, KeyboardInputMessage types
- `/packages/core/src/agent/types.ts` - BrowserToolsetLike interface with inject method signatures
- `/integrations/agent-browser/src/toolset.ts` lines 273-302 - Concrete inject method implementations
- [Hono WSContext types](https://github.com/honojs/hono) - WSMessageReceive = `string | Blob | ArrayBufferLike`, onMessage event signature
- [CDP Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) - dispatchMouseEvent and dispatchKeyEvent parameter reference

### Secondary (MEDIUM confidence)
- [Puppeteer Input.ts](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/cdp/Input.ts) - Click sequence: mouseMoved -> mousePressed -> mouseReleased
- [CDP dispatchKeyEvent sequence](https://github.com/mafredri/cdp/issues/52) - keyDown -> char -> keyUp for printable characters
- Phase 10 plan and summary - Documents the type decisions and field naming conventions
- Phase 8 research - WebSocket setup patterns, fire-and-forget pattern with `void`

### Tertiary (LOW confidence)
- WebSearch results on CDP mouse/keyboard event ordering - Confirms standard sequences but specifics vary by browser version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; all infrastructure verified in codebase
- Architecture: HIGH - Direct modification of existing placeholder; types and inject methods verified in source
- Pitfalls: HIGH - All pitfalls derived from verified code patterns and type signatures
- Validation approach: HIGH - Type guard pattern verified against existing ClientInputMessage types

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (stable domain, existing infrastructure, 30-day validity)
