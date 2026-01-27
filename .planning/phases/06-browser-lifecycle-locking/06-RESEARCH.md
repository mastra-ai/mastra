# Phase 6: Browser Lifecycle Locking - Research

**Researched:** 2026-01-27
**Domain:** Async concurrency control / Promise-based singleton patterns in TypeScript
**Confidence:** HIGH

## Summary

This research investigates the standard patterns for preventing race conditions in async lazy initialization - specifically the problem where multiple concurrent calls to `getBrowser()` can launch multiple browser instances before the first launch completes.

The Mastra codebase already uses two established patterns for this problem:
1. **Singleton Promise Pattern** - Store the initialization promise (not just the result) to ensure all concurrent callers share the same pending operation
2. **async-mutex Library** - A lightweight library already used in `@mastra/pg` and `@mastra/memory` for critical section protection

For this phase, the **Singleton Promise Pattern** is the ideal solution because:
- It's a zero-dependency solution (no new packages needed)
- It handles exactly this use case: lazy initialization that must happen exactly once
- It's already used in the Mastra codebase (see `PgVector.setupSchemaPromise`, `PgVector.installVectorExtensionPromise`)

**Primary recommendation:** Store the launch promise in a `launchPromise: Promise<BrowserManager> | null` field, assigned synchronously before awaiting, so all concurrent callers share the same pending launch.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native TypeScript | - | Promise-based locking | Built-in, zero dependencies |

### Supporting (if needed for more complex scenarios)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| async-mutex | ^0.5.x | Mutex/Semaphore for JS | When multiple distinct critical sections needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Singleton Promise | async-mutex | Mutex is heavier for single-initialization case, better for repeated critical sections |
| Singleton Promise | Custom lock class | Over-engineering for a simple lazy init pattern |

**Installation:**
No new dependencies required - using native Promise pattern.

## Architecture Patterns

### Pattern 1: Singleton Promise (RECOMMENDED)

**What:** Store the initialization promise itself (not just the resolved value) to prevent concurrent initialization attempts.

**When to use:** Lazy initialization that must happen exactly once, even when called concurrently.

**Current broken pattern (toolset.ts:79-101):**
```typescript
// BROKEN - race condition when concurrent calls occur
private async getBrowser(): Promise<BrowserManager> {
  if (!this.browserManager) {  // Both A and B see null here
    const manager = new BrowserManager();
    await manager.launch({...});  // Both A and B launch browsers
    this.browserManager = manager;  // Only one gets saved
  }
  return this.browserManager;
}
```

**Fixed pattern with Singleton Promise:**
```typescript
// Source: https://www.jonmellman.com/posts/singleton-promises/
// Also verified in Mastra codebase: stores/pg/src/vector/index.ts

private browserManager: BrowserManager | null = null;
private launchPromise: Promise<BrowserManager> | null = null;

private async getBrowser(): Promise<BrowserManager> {
  // Already initialized - return immediately
  if (this.browserManager) {
    return this.browserManager;
  }

  // No launch in progress - start one
  // CRITICAL: Assignment happens SYNCHRONOUSLY before any await
  if (!this.launchPromise) {
    this.launchPromise = this.initBrowser();
  }

  // All concurrent callers share the same promise
  return this.launchPromise;
}

private async initBrowser(): Promise<BrowserManager> {
  const manager = new BrowserManager();
  try {
    await manager.launch({
      id: 'browser-toolset-launch',
      action: 'launch',
      headless: this.config.headless,
    });
    this.browserManager = manager;
    return manager;
  } catch (error) {
    // Reset promise on failure to allow retry
    this.launchPromise = null;
    try {
      await manager.close();
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

**Why this works:**
- The `if (!this.launchPromise)` check and assignment happen **synchronously** (no `await` between them)
- JavaScript's single-threaded event loop guarantees no interleaving during synchronous code
- All concurrent callers receive the same promise and await the same operation
- Resolved promises can be awaited multiple times with zero additional latency

### Pattern 2: async-mutex (for reference)

**What:** A library providing Mutex and Semaphore for async critical sections.

**When to use:** When you need to protect multiple different critical sections, or need advanced features like timeouts or cancellation.

**Example from Mastra codebase (stores/pg/src/vector/index.ts):**
```typescript
// Source: stores/pg/src/vector/index.ts lines 17, 83, 628-631
import { Mutex } from 'async-mutex';

private mutexesByName = new Map<string, Mutex>();

private getMutexByName(indexName: string) {
  if (!this.mutexesByName.has(indexName)) {
    this.mutexesByName.set(indexName, new Mutex());
  }
  return this.mutexesByName.get(indexName)!;
}

// Usage in createIndex:
const mutex = this.getMutexByName(`create-${indexName}`);
await mutex.runExclusive(async () => {
  // Critical section - only one call executes at a time
  // ...
});
```

**Not recommended for this phase because:**
- BrowserToolset has a single critical section (browser launch)
- Singleton Promise is simpler and sufficient
- No need for the additional features (timeout, cancellation, multiple locks)

### Anti-Patterns to Avoid

- **Boolean flag check:** Checking `if (!this.isInitializing)` is just as broken - the flag can be true for multiple callers before any sets it to false
- **Double-check without promise storage:** The classic double-checked locking pattern doesn't work with async operations
- **Storing result only:** Storing only `this.browserManager` (the resolved value) doesn't prevent concurrent initialization

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent initialization prevention | Custom lock class | Singleton Promise pattern | Built-in, proven, zero dependencies |
| Complex critical sections | Multiple boolean flags | async-mutex library | Already battle-tested, in use in codebase |
| Retry-on-failure | Complex state machine | Reset promise to null on error | Simple, allows clean retry |

**Key insight:** The Singleton Promise pattern is deceptively simple - storing a Promise instead of a boolean is the entire solution. The JavaScript event loop guarantees synchronous code runs atomically, so the check-and-assign pattern works correctly.

## Common Pitfalls

### Pitfall 1: Checking value instead of promise
**What goes wrong:** Code checks `if (!this.browserManager)` but launches are async - multiple callers pass the check before first launch completes.
**Why it happens:** Natural instinct is to check the final value, not the in-progress operation.
**How to avoid:** Store and check the promise, not the resolved value.
**Warning signs:** Multiple browser windows appearing, orphaned processes.

### Pitfall 2: Not resetting promise on failure
**What goes wrong:** If initialization fails, the rejected promise is cached, and all future calls immediately reject without retry.
**Why it happens:** Forgetting that failed promises stay failed.
**How to avoid:** Set `this.launchPromise = null` in the catch block before re-throwing.
**Warning signs:** Browser launch fails once, then all subsequent calls fail without retry.

### Pitfall 3: Async gap between check and assignment
**What goes wrong:** Code like `if (!this.launchPromise) { await something(); this.launchPromise = ...}` allows interleaving.
**Why it happens:** Misunderstanding that `await` yields control to the event loop.
**How to avoid:** Assignment must be **synchronous** after the check - no `await` between.
**Warning signs:** Race condition still occurs despite having a promise field.

### Pitfall 4: Forgetting to update close() method
**What goes wrong:** `close()` only nullifies `browserManager` but not `launchPromise`, causing inconsistent state.
**Why it happens:** Adding new field but forgetting to update cleanup code.
**How to avoid:** Update `close()` to also set `this.launchPromise = null`.
**Warning signs:** After close, next getBrowser() call returns stale/closed browser.

## Code Examples

### Complete getBrowser() implementation with locking

```typescript
// Source: Synthesis of patterns from Mastra codebase and
// https://www.jonmellman.com/posts/singleton-promises/

export class BrowserToolset {
  /** Internal BrowserManager instance, lazily initialized */
  private browserManager: BrowserManager | null = null;

  /** Promise for in-progress browser launch - prevents concurrent launches */
  private launchPromise: Promise<BrowserManager> | null = null;

  /**
   * Lazily initializes and returns the browser instance.
   * Uses Singleton Promise pattern to prevent concurrent launches.
   */
  private async getBrowser(): Promise<BrowserManager> {
    // Fast path: already initialized
    if (this.browserManager) {
      return this.browserManager;
    }

    // Start launch if not in progress
    // CRITICAL: This assignment is synchronous - no await between check and assign
    if (!this.launchPromise) {
      this.launchPromise = this.launchBrowser();
    }

    // All concurrent callers share this same promise
    return this.launchPromise;
  }

  /**
   * Internal method that performs the actual browser launch.
   * Only called once per toolset lifecycle (unless launch fails).
   */
  private async launchBrowser(): Promise<BrowserManager> {
    const manager = new BrowserManager();
    try {
      await manager.launch({
        id: 'browser-toolset-launch',
        action: 'launch',
        headless: this.config.headless,
      });
      // Store the successfully launched browser
      this.browserManager = manager;
      return manager;
    } catch (error) {
      // Reset promise to allow retry on next call
      this.launchPromise = null;
      // Clean up partial state
      try {
        await manager.close();
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Closes the browser and releases resources.
   */
  async close(): Promise<void> {
    // Clear the launch promise to allow fresh launch after close
    this.launchPromise = null;

    if (this.browserManager) {
      try {
        await this.browserManager.close();
      } catch (error) {
        console.warn('[BrowserToolset] Error closing browser:', error);
      } finally {
        this.browserManager = null;
      }
    }
  }
}
```

### Test case to verify locking works

```typescript
// Test that concurrent getBrowser() calls share the same browser
describe('BrowserToolset concurrent access', () => {
  it('should share browser instance when called concurrently', async () => {
    const toolset = new BrowserToolset({ headless: true });

    // Call getBrowser() 3 times concurrently
    const [browser1, browser2, browser3] = await Promise.all([
      toolset['getBrowser'](),
      toolset['getBrowser'](),
      toolset['getBrowser'](),
    ]);

    // All should be the same instance
    expect(browser1).toBe(browser2);
    expect(browser2).toBe(browser3);

    await toolset.close();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boolean flags (`isInitializing`) | Singleton Promise | Always was problematic | Eliminates race conditions |
| Check-before-launch | Store promise synchronously | N/A | Simple pattern, often overlooked |

**Deprecated/outdated:**
- Boolean flag locking: Never worked correctly for async operations in single-threaded JS

## Open Questions

None - this is a well-understood pattern with clear implementation.

## Sources

### Primary (HIGH confidence)
- Mastra codebase: `stores/pg/src/vector/index.ts` - Shows both async-mutex usage and Promise|null pattern for lazy init
- Mastra codebase: `packages/memory/src/index.ts` - Shows Mutex usage for concurrent update protection

### Secondary (MEDIUM confidence)
- [Singleton Promises - Jon Mellman](https://www.jonmellman.com/posts/singleton-promises/) - Detailed explanation of the pattern
- [async-mutex npm](https://www.npmjs.com/package/async-mutex) - Official documentation for the library
- [async-mutex GitHub](https://github.com/DirtyHairy/async-mutex) - Full API reference

### Tertiary (LOW confidence)
- [Robust Singleton Promise Handler](https://dev.to/bmarotta/writing-a-robust-singleton-promise-handler-43if) - Additional edge cases
- [Async-Mutex Race Conditions](https://riochndr.com/deep-dives/2025/01/async-mutex-a-javascript-library-to-prevent-race-conditions/) - Alternative approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using patterns already in Mastra codebase
- Architecture: HIGH - Singleton Promise is well-documented, verified in codebase
- Pitfalls: HIGH - Common failure modes are well-understood

**Research date:** 2026-01-27
**Valid until:** Indefinitely stable - this is a fundamental JS/TS pattern
