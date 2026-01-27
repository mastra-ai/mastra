# Phase 7: Screencast API - Research

**Researched:** 2026-01-27
**Domain:** CDP Screencast API, Event Emitter patterns, TypeScript
**Confidence:** HIGH

## Summary

This research investigates how to expose CDP (Chrome DevTools Protocol) screencast and input injection functionality through BrowserToolset. The underlying `agent-browser` library (v0.8.0) already provides complete screencast capabilities via `BrowserManager.startScreencast()`, `stopScreencast()`, `injectMouseEvent()`, and `injectKeyboardEvent()`. The work is wrapping these with an event emitter pattern for clean consumption.

The CONTEXT.md decisions lock in several key choices:
- Event emitter pattern: `screencast.on('frame', callback)` with lifecycle events (`frame`, `error`, `stop`, `reconnecting`, `reconnected`)
- Structured frame object: `{ data, timestamp, viewport, sessionId }` with base64-encoded data
- Manual start only (no auto-start with browser)
- Multiple independent screencasts allowed
- 3 retries with notification before emitting final error
- Raw CDP passthrough for input injection

The primary implementation challenge is wrapping BrowserManager's callback-based screencast API with a type-safe event emitter that handles lifecycle coordination (waiting for browser if not launched) and error recovery (auto-retry with reconnection events).

**Primary recommendation:** Use Node.js EventEmitter with `typed-emitter` for type safety, wrapping BrowserManager's existing screencast methods with lifecycle management and retry logic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `agent-browser` | ^0.8.0 | CDP screencast source | Already integrated; provides `startScreencast()`, `stopScreencast()`, `injectMouseEvent()`, `injectKeyboardEvent()` |
| `events` (Node.js) | built-in | Event emitter base | Standard Node.js pattern, no dependencies |
| `typed-emitter` | ^2.1.0 | Type-safe events | Zero-runtime types for EventEmitter, already a pattern recommendation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | No additional deps needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `typed-emitter` | Declaration merging | More verbose, repetitive for full API coverage |
| `typed-emitter` | `eventemitter3` | Different emitter implementation, adds abstraction |
| Native EventEmitter | Custom wrapper class | Over-engineering; typed-emitter is simpler |

**Installation:**
```bash
# In integrations/agent-browser
pnpm add typed-emitter
```

Note: `typed-emitter` is a devDependency (types only, zero runtime), but should be a regular dependency since the types are exported in the public API.

## Architecture Patterns

### Recommended Module Structure
```
integrations/agent-browser/src/
├── screencast/
│   ├── index.ts           # Re-exports
│   ├── types.ts           # ScreencastEvents, ScreencastOptions, ScreencastFrame
│   ├── screencast-stream.ts  # ScreencastStream class (event emitter)
│   └── constants.ts       # Default options, retry config
├── toolset.ts             # BrowserToolset (add screencast methods)
└── ...
```

### Pattern 1: ScreencastStream Class with Typed Events
**What:** A class that wraps BrowserManager's screencast callback with an event emitter interface.

**When to use:** Always - this is the core deliverable.

**Example:**
```typescript
// Source: typed-emitter pattern from https://github.com/andywer/typed-emitter
import EventEmitter from 'events';
import type TypedEmitter from 'typed-emitter';
import type { ScreencastFrame, ScreencastOptions as CDPScreencastOptions } from 'agent-browser/dist/browser.js';

// Event type definitions
export interface ScreencastEvents {
  frame: (frame: ScreencastFrameData) => void;
  error: (error: ScreencastError) => void;
  stop: (reason: 'manual' | 'browser_closed' | 'error') => void;
  reconnecting: (attempt: number, maxAttempts: number) => void;
  reconnected: () => void;
}

// Structured frame data exposed to consumers
export interface ScreencastFrameData {
  /** Base64-encoded image data (JPEG or PNG) */
  data: string;
  /** Unix timestamp when frame was captured */
  timestamp: number;
  /** Viewport dimensions and scroll info */
  viewport: {
    width: number;
    height: number;
    offsetTop: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    pageScaleFactor: number;
  };
  /** CDP session ID for this frame (used internally for ack) */
  sessionId: number;
}

// User-facing options (subset of CDP options with defaults)
export interface ScreencastOptions {
  format?: 'jpeg' | 'png';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  everyNthFrame?: number;
}

export class ScreencastStream extends (EventEmitter as new () => TypedEmitter<ScreencastEvents>) {
  private active = false;
  private browserManager: BrowserManager | null = null;

  /** Stop the screencast and release resources */
  async stop(): Promise<void> {
    // Implementation
  }

  /** Check if screencast is currently active */
  isActive(): boolean {
    return this.active;
  }
}
```

### Pattern 2: Lazy Browser Wait in startScreencast
**What:** If browser isn't launched when `startScreencast()` is called, wait for launch rather than erroring.

**When to use:** Per CONTEXT.md decision - "If `startScreencast()` called before browser exists, wait for browser launch then start"

**Example:**
```typescript
// In BrowserToolset.startScreencast()
async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
  // Wait for browser to be ready (reuses existing getBrowser singleton promise pattern)
  const browser = await this.getBrowser();

  const stream = new ScreencastStream(browser, options);
  await stream.start();
  return stream;
}
```

### Pattern 3: Retry with Reconnection Events
**What:** Auto-retry on error with event notification, following Mastra's existing fetchWithRetry pattern.

**When to use:** Per CONTEXT.md - "3 retries before giving up and emitting final error"

**Example:**
```typescript
// Based on packages/core/src/utils/fetchWithRetry.ts pattern
private async retryScreencast(): Promise<void> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      this.emit('reconnecting', attempt, MAX_RETRIES);
      await this.startInternal();
      this.emit('reconnected');
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        this.emit('error', this.createError(error, 'retry_exhausted'));
        this.emit('stop', 'error');
        return;
      }
      // Exponential backoff: 1s, 2s, 4s (capped at 10s)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Anti-Patterns to Avoid

- **Custom EventEmitter implementation:** Use Node.js built-in with typed-emitter, not a hand-rolled solution
- **Blocking on browser launch:** Don't block forever; use existing getBrowser() timeout
- **Ignoring CDP ack:** MUST call `screencastFrameAck` for each frame to prevent memory exhaustion
- **Exposing CDP internals:** Keep frame callback and ack handling internal; consumers only see clean events

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe events | Custom EventEmitter wrapper | `typed-emitter` | Zero runtime, proven pattern |
| CDP screencast | Direct CDP calls | `agent-browser.startScreencast()` | Already handles ack, lifecycle |
| Input injection | Direct CDP calls | `agent-browser.injectMouseEvent/KeyboardEvent()` | Already typed, validated |
| Retry logic | Complex state machine | Simple loop with exponential backoff | Follows Mastra `fetchWithRetry` pattern |

**Key insight:** BrowserManager already handles the hard parts (CDP session management, frame ack). The screencast API phase is primarily about wrapping with events and lifecycle coordination.

## Common Pitfalls

### Pitfall 1: Missing screencastFrameAck
**What goes wrong:** Memory exhaustion in Chrome; frames buffer up without being acknowledged.
**Why it happens:** CDP requires explicit acknowledgment to continue sending frames (flow control).
**How to avoid:** BrowserManager handles this internally - verify it calls `Page.screencastFrameAck` with the sessionId.
**Warning signs:** Memory grows unbounded during screencast, frames stop arriving after ~100 frames.

### Pitfall 2: Not handling browser close during screencast
**What goes wrong:** Screencast callbacks throw errors when browser closes; uncaught exceptions.
**Why it happens:** CDP session becomes invalid when browser closes.
**How to avoid:** Listen for browser close event, emit 'stop' with reason 'browser_closed', clean up state.
**Warning signs:** Unhandled promise rejections when browser closes during screencast.

### Pitfall 3: Multiple startScreencast without stop
**What goes wrong:** Per CONTEXT.md, multiple independent screencasts are allowed, but each returns a new stream.
**Why it happens:** Calling `startScreencast()` twice without stopping first.
**How to avoid:** Document that each call returns an independent stream; consumers must track and stop each.
**Warning signs:** Multiple frame callbacks firing, duplicate frames being processed.

### Pitfall 4: Not resetting state on stop
**What goes wrong:** Stream reports `isActive: true` after stop; events still fire.
**Why it happens:** Forgetting to clean up internal state in stop().
**How to avoid:** Clear callback, reset active flag, remove event listeners.
**Warning signs:** `isActive()` returns true after calling `stop()`.

### Pitfall 5: Event listener memory leaks
**What goes wrong:** Consumers add listeners but never remove them; memory grows over time.
**Why it happens:** EventEmitter holds references to listener functions.
**How to avoid:** Document that stream emits 'stop' event before cleanup; recommend using `once()` for one-time handlers.
**Warning signs:** Node.js warning about too many listeners.

## Code Examples

### ScreencastStream Full Implementation Skeleton

```typescript
// Source: Synthesis of agent-browser API and typed-emitter pattern
import EventEmitter from 'events';
import type TypedEmitter from 'typed-emitter';
import type { BrowserManager, ScreencastFrame, ScreencastOptions as CDPOptions } from 'agent-browser/dist/browser.js';

export interface ScreencastEvents {
  frame: (frame: ScreencastFrameData) => void;
  error: (error: ScreencastError) => void;
  stop: (reason: 'manual' | 'browser_closed' | 'error') => void;
  reconnecting: (attempt: number, maxAttempts: number) => void;
  reconnected: () => void;
}

export interface ScreencastFrameData {
  data: string;
  timestamp: number;
  viewport: {
    width: number;
    height: number;
    offsetTop: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    pageScaleFactor: number;
  };
  sessionId: number;
}

export interface ScreencastError {
  code: 'cdp_error' | 'browser_closed' | 'retry_exhausted' | 'unknown';
  message: string;
  cause?: Error;
  canRetry: boolean;
}

export interface ScreencastOptions {
  format?: 'jpeg' | 'png';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  everyNthFrame?: number;
}

const DEFAULTS: Required<ScreencastOptions> = {
  format: 'jpeg',
  quality: 70,
  maxWidth: 1280,
  maxHeight: 720,
  everyNthFrame: 2,
};

const MAX_RETRIES = 3;

export class ScreencastStream extends (EventEmitter as new () => TypedEmitter<ScreencastEvents>) {
  private active = false;
  private options: Required<ScreencastOptions>;

  constructor(
    private browserManager: BrowserManager,
    options?: ScreencastOptions
  ) {
    super();
    this.options = { ...DEFAULTS, ...options };
  }

  async start(): Promise<void> {
    if (this.active) {
      return; // Already running
    }

    await this.startInternal();
    this.active = true;
  }

  private async startInternal(): Promise<void> {
    await this.browserManager.startScreencast(
      (frame: ScreencastFrame) => {
        // Transform CDP frame to our structured format
        const frameData: ScreencastFrameData = {
          data: frame.data,
          timestamp: frame.metadata.timestamp ?? Date.now(),
          viewport: {
            width: frame.metadata.deviceWidth,
            height: frame.metadata.deviceHeight,
            offsetTop: frame.metadata.offsetTop,
            scrollOffsetX: frame.metadata.scrollOffsetX,
            scrollOffsetY: frame.metadata.scrollOffsetY,
            pageScaleFactor: frame.metadata.pageScaleFactor,
          },
          sessionId: frame.sessionId,
        };
        this.emit('frame', frameData);
        // Note: BrowserManager handles screencastFrameAck internally
      },
      this.options
    );
  }

  async stop(): Promise<void> {
    if (!this.active) {
      return; // Already stopped
    }

    this.active = false;
    try {
      await this.browserManager.stopScreencast();
    } catch (error) {
      // Log but don't throw - cleanup should be best-effort
      console.warn('[ScreencastStream] Error stopping screencast:', error);
    }
    this.emit('stop', 'manual');
  }

  isActive(): boolean {
    return this.active;
  }
}
```

### BrowserToolset Integration

```typescript
// In integrations/agent-browser/src/toolset.ts
import { ScreencastStream, ScreencastOptions } from './screencast/index.js';
import type { BrowserManager } from 'agent-browser/dist/browser.js';

export class BrowserToolset {
  // ... existing code ...

  /**
   * Start screencast streaming. Returns a stream object with event emitter interface.
   *
   * @example
   * const stream = await browserTools.startScreencast({ quality: 80 });
   * stream.on('frame', (frame) => {
   *   console.log(`Frame: ${frame.viewport.width}x${frame.viewport.height}`);
   * });
   * stream.on('stop', (reason) => console.log('Stopped:', reason));
   * await stream.stop();
   */
  async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    // Wait for browser - uses existing singleton promise pattern
    const browser = await this.getBrowser();

    const stream = new ScreencastStream(browser, options);
    await stream.start();
    return stream;
  }

  /**
   * Inject a mouse event via CDP passthrough.
   *
   * @param event CDP-compatible mouse event parameters
   */
  async injectMouseEvent(event: {
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
    x: number;
    y: number;
    button?: 'left' | 'right' | 'middle' | 'none';
    clickCount?: number;
    deltaX?: number;
    deltaY?: number;
    modifiers?: number;
  }): Promise<void> {
    const browser = await this.getBrowser();
    await browser.injectMouseEvent(event);
  }

  /**
   * Inject a keyboard event via CDP passthrough.
   *
   * @param event CDP-compatible keyboard event parameters
   */
  async injectKeyboardEvent(event: {
    type: 'keyDown' | 'keyUp' | 'char';
    key?: string;
    code?: string;
    text?: string;
    modifiers?: number;
  }): Promise<void> {
    const browser = await this.getBrowser();
    await browser.injectKeyboardEvent(event);
  }
}
```

### Type Definitions for Export

```typescript
// In integrations/agent-browser/src/types.ts (additions)
import { z } from 'zod';

// ============================================================================
// Screencast Schemas
// ============================================================================

export const screencastOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png']).optional().default('jpeg'),
  quality: z.number().min(0).max(100).optional().default(70),
  maxWidth: z.number().positive().optional().default(1280),
  maxHeight: z.number().positive().optional().default(720),
  everyNthFrame: z.number().positive().optional().default(2),
});

export type ScreencastOptions = z.infer<typeof screencastOptionsSchema>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Callback-only screencast | Event emitter wrapper | This phase | Cleaner API for consumers |
| Direct CDP calls | BrowserManager abstraction | agent-browser v0.8.0 | Handles ack, lifecycle |
| Manual type declarations | typed-emitter | 2023+ | Zero-runtime type safety |

**Deprecated/outdated:**
- Raw CDP manipulation: agent-browser handles this now
- Untyped EventEmitter: typed-emitter provides full type coverage

## Open Questions

1. **Browser close during screencast behavior**
   - What we know: CONTEXT.md says "Claude's discretion (likely emit 'stop' event)"
   - What's unclear: Should it also emit an 'error' event before 'stop'?
   - Recommendation: Emit 'stop' with reason 'browser_closed', no error event (browser close is expected lifecycle)

2. **Multiple screencasts resource limits**
   - What we know: Multiple independent screencasts allowed per CONTEXT.md
   - What's unclear: Is there a practical limit? Does CDP support multiple screencast sessions?
   - Recommendation: Allow multiple (CDP supports it via different targets), document that each has overhead

3. **Touch event injection**
   - What we know: BrowserManager has `injectTouchEvent()` for mobile emulation
   - What's unclear: Should CAST-04/CAST-05 include touch events?
   - Recommendation: Defer to future phase - CAST-04/CAST-05 explicitly mention mouse and keyboard only

## Sources

### Primary (HIGH confidence)
- `agent-browser` v0.8.0 type definitions: `/node_modules/.pnpm/agent-browser@0.8.0/node_modules/agent-browser/dist/browser.d.ts`
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/tot/Input/
- `typed-emitter` GitHub: https://github.com/andywer/typed-emitter

### Secondary (MEDIUM confidence)
- Mastra codebase `fetchWithRetry`: `/packages/core/src/utils/fetchWithRetry.ts` - retry pattern reference
- Phase 6 RESEARCH.md: Singleton promise pattern for browser lifecycle
- STACK-liveview.md: Prior research on screencast integration

### Tertiary (LOW confidence)
- WebSearch results on Puppeteer/Playwright memory leaks - general patterns, not screencast-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using agent-browser's existing API, typed-emitter is well-documented
- Architecture: HIGH - Event emitter pattern is standard, code examples verified against agent-browser types
- Pitfalls: MEDIUM - CDP ack is documented, but retry behavior needs validation in practice

**Research date:** 2026-01-27
**Valid until:** 60 days (agent-browser API is stable, CDP screencast is mature)
