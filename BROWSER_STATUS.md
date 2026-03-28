# Browser Integration Status

**Last Updated:** March 28, 2026

This document consolidates browser planning, status, and feature requests for Mastra's browser integration.

---

## Table of Contents

1. [Current State](#current-state)
2. [Feature Parity: AgentBrowser vs StagehandBrowser](#feature-parity-agentbrowser-vs-stagehandbrowser)
3. [Stagehand Limitations & Workarounds](#stagehand-limitations--workarounds)
4. [Plan B: Playwright Integration for Stagehand](#plan-b-playwright-integration-for-stagehand)
5. [Questions for Browserbase](#questions-for-browserbase)
6. [Future Work](#future-work)
7. [Architecture Reference](#architecture-reference)

---

## Current State

### What's Working (March 28, 2026)

**SDK Providers** (`AgentBrowser`, `StagehandBrowser`):

- ✅ Full browser lifecycle management
- ✅ Screencast streaming via CDP
- ✅ Thread isolation (`'none'`, `'browser'` modes)
- ✅ Input injection (mouse/keyboard) with threadId support
- ✅ Tab management tools
- ✅ Tab change detection for screencast reconnection
- ✅ Browser close detection and URL restoration
- ✅ Headless/headed mode configuration

**CLI Providers** (`agent-browser`, `browser-use`):

- ✅ CDP discovery via command or process inspection
- ✅ Screencast streaming
- ✅ Headed mode via environment variable
- ❌ No thread isolation (single browser per workspace)

---

## Feature Parity: AgentBrowser vs StagehandBrowser

### Fully Working (No Issues)

| Feature                                      | AgentBrowser | StagehandBrowser | Notes                                      |
| -------------------------------------------- | ------------ | ---------------- | ------------------------------------------ |
| `'browser'` isolation mode                   | ✅           | ✅               | Each thread gets own browser instance      |
| `'none'` isolation mode                      | ✅           | ✅               | All threads share single browser           |
| Thread-aware `getCurrentUrl(threadId)`       | ✅           | ✅               |                                            |
| Thread-aware `injectMouseEvent(threadId)`    | ✅           | ✅               |                                            |
| Thread-aware `injectKeyboardEvent(threadId)` | ✅           | ✅               |                                            |
| Agent-initiated navigation                   | ✅           | ✅               | `goto()` / `navigate()` tools              |
| Agent tab management                         | ✅           | ✅               | `browser_tabs` / `stagehand_tabs`          |
| Manual click in screencast                   | ✅           | ✅               | CDP input injection                        |
| Browser close detection                      | ✅           | ✅               | `context.on('close')` + `page.on('close')` |
| URL restoration on relaunch                  | ✅           | ✅               | `lastUrl` tracking                         |

### Working with Workarounds

| Feature                         | AgentBrowser            | StagehandBrowser | Workaround Used                                        |
| ------------------------------- | ----------------------- | ---------------- | ------------------------------------------------------ |
| Fresh CDP sessions on reconnect | ✅ Native               | ✅ Workaround    | Stagehand: manually create new session each time       |
| Tab change detection            | ✅ `context.on('page')` | ⚠️ CDP events    | Access private `_conn` for `Target.attachedToTarget`   |
| Page discovery                  | ✅ `context.pages()`    | ⚠️ CDP fallback  | Use `Target.getTargets` when `pages()` incomplete      |
| Manual click opens new tab      | ✅ Works                | ⚠️ Flaky         | Stagehand doesn't always track `target="_blank"` pages |

### Not Working (Limitations)

| Feature                             | AgentBrowser | StagehandBrowser | Root Cause                                         |
| ----------------------------------- | ------------ | ---------------- | -------------------------------------------------- |
| Manual new tab (browser "+" button) | ✅ Works     | ❌ Not tracked   | Stagehand only tracks pages created via its API    |
| Manual tab switch (browser tab bar) | ❌           | ❌               | Neither Playwright nor Stagehand expose this event |
| `page.on('framenavigated')`         | ✅ Works     | ❌ Throws error  | Stagehand v3 doesn't support this event            |
| URL bar reliability                 | ✅ Reliable  | ⚠️ Flaky         | Stagehand CDP workarounds less stable              |

---

## Stagehand Limitations & Workarounds

### Current Workarounds in Our Code

#### 1. CDP Connection Access ✅ RESOLVED

```typescript
// context.conn is public in Stagehand v3.2.0+
const conn = stagehand.context.conn;
conn.getTargets();  // Get all targets directly
conn.on('Target.targetCreated', handler);  // Listen for events
conn.send('Target.attachToTarget', { targetId, flatten: true });  // Send CDP commands
```

#### 2. Page Discovery

```typescript
// Problem: context.pages() only returns Stagehand-created pages
// Solution: Use conn.getTargets() (public API)
const targets = await conn.getTargets();
const pageTargets = targets.filter(t => t.type === 'page' && t.attached);
```

#### 3. Tab Change Events ✅ RESOLVED

```typescript
// conn.on() is public - no need for private access
const conn = stagehand.context.conn;
conn.on('Target.targetCreated', params => {
  if (params.targetInfo.type === 'page') {
    this.reconnectScreencast();
  }
});
```

#### 4. Fresh CDP Sessions

```typescript
// Problem: Stagehand caches CDP sessions
// Workaround: Create new session on each reconnect
const page = stagehand.context.activePage();
const mainFrameId = (page as any)._mainFrame?._id;
const session = await page.getSessionForFrame(mainFrameId);
```

---

## Playwright Integration for Stagehand

Stagehand v3 officially supports Playwright integration via `stagehand.connectURL()`. This can solve our limitations.

**Reference:** https://docs.stagehand.dev/v3/integrations/playwright

### How It Works

```typescript
import { Stagehand } from '@browserbasehq/stagehand';
import { chromium } from 'playwright-core';

const stagehand = new Stagehand({ env: 'LOCAL' });
await stagehand.init();

// Connect Playwright to Stagehand's browser via CDP
const browser = await chromium.connectOverCDP({
  wsEndpoint: stagehand.connectURL(), // Returns the CDP WebSocket URL
});
const pwContext = browser.contexts()[0];
const pwPage = pwContext.pages()[0];

// Now you can use BOTH:
// - Playwright for events: pwContext.on('page'), pwPage.on('framenavigated')
// - Stagehand for AI: stagehand.act(), stagehand.extract(), stagehand.observe()
```

### What This Enables

| Limitation                        | Current Workaround                            | With Playwright                  |
| --------------------------------- | --------------------------------------------- | -------------------------------- |
| Tab change detection              | CDP `Target.targetCreated` on private `_conn` | `pwContext.on('page')` ✅        |
| `page.on('framenavigated')`       | Not supported, throws error                   | `pwPage.on('framenavigated')` ✅ |
| Page discovery                    | CDP `Target.getTargets` fallback              | `pwContext.pages()` ✅           |
| Manual tab creation (browser "+") | Not detected                                  | `pwContext.on('page')` ✅        |
| Manual tab switch (browser UI)    | Not detected                                  | Still not possible ❌            |

### Implementation Plan

1. **After `stagehand.init()`**, connect Playwright:

   ```typescript
   this.playwrightBrowser = await chromium.connectOverCDP({
     wsEndpoint: stagehand.connectURL(),
   });
   this.playwrightContext = this.playwrightBrowser.contexts()[0];
   ```

2. **Use Playwright for event handling**:

   ```typescript
   // Tab detection - replaces CDP Target.targetCreated workaround
   this.playwrightContext.on('page', page => {
     this.reconnectScreencast('new tab via Playwright');
   });

   // Frame navigation - currently unsupported
   pwPage.on('framenavigated', frame => {
     if (frame === pwPage.mainFrame()) {
       this.updateUrl(frame.url());
     }
   });
   ```

3. **Keep using Stagehand for AI operations**:

   ```typescript
   // AI tools still use Stagehand
   await stagehand.act('click the login button');
   const data = await stagehand.extract('get form data', schema);
   ```

4. **Input injection** - can use either:
   - Current: CDP `Input.dispatchMouseEvent` (works)
   - Alternative: Playwright `page.mouse.click()` (more reliable)

### Benefits

- **Full event support** like AgentBrowser
- **Keep Stagehand AI tools** (`act`, `extract`, `observe`, `agent`)
- **Remove workarounds** for CDP connection, Target events, page discovery
- **Officially supported** by Browserbase

### Considerations

1. **Two libraries managing same browser** - Need to be careful about conflicts
2. **Page object mismatch** - Playwright pages vs Stagehand pages need mapping
3. **Memory** - Additional overhead from Playwright connection

### Known Issue

There's a [GitHub issue #1392](https://github.com/browserbase/stagehand/issues/1392) about `StagehandInitError: Failed to resolve V3 Page from Playwright page` when passing Playwright pages to Stagehand methods. We may need to:

- Use Stagehand's own page for AI operations
- Use Playwright pages only for events and input injection

---

## Questions for Browserbase

### Category 1: What Works Well (No Questions Needed)

These features work identically to AgentBrowser - no questions needed:

- Thread isolation via separate Stagehand instances
- `getCurrentUrl()` / `injectMouseEvent()` / `injectKeyboardEvent()`
- Basic agent navigation and tab management
- Browser close detection

### Category 2: Working with Workarounds (Seeking Better Approaches)

**Q1: Public CDP Connection Access**

> We currently access `context._conn` to listen for CDP Target events and call `Target.getTargets`. Is there a public API for this, or plans to add one like `context.cdpConnection`?

**Q2: Fresh CDP Sessions**

> When reconnecting screencasts, we need fresh CDP sessions. Currently we call `page.getSessionForFrame(mainFrameId)` each time, but we're not sure if this is the intended usage. Is there a better pattern for getting a non-cached CDP session?

**Q3: Page Discovery**

> `context.pages()` doesn't return pages opened via `target="_blank"` links. We fall back to `Target.getTargets` via CDP. Is this expected behavior? Is there a way to make `pages()` track all pages?

**Q4: Tab Change Detection**

> We listen to `Target.attachedToTarget` on the private `_conn` to detect new tabs. Is there a public event emitter planned, like `context.on('page')`?

### Category 3: Not Working (Limitations)

**Q5: Manual Tab Creation**

> Pages created by clicking the browser's "+" button are not tracked by `context.pages()` or via CDP Target events. Is this a fundamental limitation of how Stagehand connects to Chrome, or is there a way to detect these?

**Q6: Manual Tab Switching**

> When a user clicks a different tab in the browser's tab bar, we can't detect this. `activePage()` doesn't update. Is there any way to detect which tab has focus?

**Q7: `page.on('framenavigated')` Support**

> This throws `InvalidArgumentError: Unsupported event`. We need this for detecting same-tab navigation. Is support planned?

**Q8: Playwright Integration**

> As a fallback, could we connect Playwright to the same browser Stagehand controls? Would you expose the CDP WebSocket URL for this? Are there known issues with running both libraries on the same browser?

---

## Future Work

### Priority 1: Short-term Improvements

| Item                    | Complexity | Description                                 |
| ----------------------- | ---------- | ------------------------------------------- |
| File Browserbase issues | Low        | Submit questions above as GitHub issues     |
| Document workarounds    | Low        | Ensure all workarounds have inline comments |
| Test edge cases         | Medium     | Manual tab creation, rapid tab switching    |

### Priority 2: Medium-term Features

| Item                        | Complexity  | Description                                   |
| --------------------------- | ----------- | --------------------------------------------- |
| CLI Thread Isolation        | Medium-High | Spawn browser per thread using processManager |
| Browser Session Persistence | Medium      | Store URL/cookies per thread to disk          |
| Unified Binary Resolution   | Low-Medium  | Shared utility for CLI/LSP binary discovery   |

### Priority 3: Long-term Enhancements

| Item                           | Complexity  | Description                                 |
| ------------------------------ | ----------- | ------------------------------------------- |
| Playwright + Stagehand hybrid  | High        | Use Playwright for events, Stagehand for AI |
| Remote Browser Support (CLI)   | Low         | Add `cdpUrl` support to BrowserViewer       |
| Screencast Quality/Performance | Medium-High | Adaptive bitrate, WebRTC option             |
| Multi-Page/Tab Support (CLI)   | Medium      | Tab list in Studio UI for CLI providers     |

---

## Architecture Reference

### Component Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             Studio UI                                     │
│    - Displays screencast frames (base64 JPEG)                            │
│    - Captures mouse/keyboard events                                       │
│    - WebSocket connection to server                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         ViewerRegistry                                    │
│         (manages screencasts, broadcasts frames)                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│      SDK Providers           │         │      CLI Providers           │
│  (AgentBrowser,              │         │  (BrowserViewer)             │
│   StagehandBrowser)          │         │                              │
├──────────────────────────────┤         ├──────────────────────────────┤
│ • Launches browser           │         │ • Discovers CDP URL          │
│ • Owns CDP session           │         │ • Connects to existing       │
│ • Provides tools             │         │ • No tools (uses skills)     │
│ • Thread isolation ✓         │         │ • Thread isolation ✗         │
└──────────────────────────────┘         └──────────────────────────────┘
```

### Key Files

| Area              | File                                                        |
| ----------------- | ----------------------------------------------------------- |
| Base browser      | `packages/core/src/browser/browser.ts`                      |
| Thread isolation  | `packages/core/src/browser/thread-manager.ts`               |
| Screencast        | `packages/core/src/browser/screencast/screencast-stream.ts` |
| Server-side       | `packages/server/src/server/browser-stream/`                |
| SDK: AgentBrowser | `browser/agent-browser/src/agent-browser.ts`                |
| SDK: Stagehand    | `browser/stagehand/src/stagehand-browser.ts`                |
| Workspace         | `packages/core/src/workspace/workspace.ts`                  |

### Isolation Modes

| Mode        | Behavior                              | Use Case                      |
| ----------- | ------------------------------------- | ----------------------------- |
| `'none'`    | All threads share single browser      | Simple agents, shared state   |
| `'browser'` | Each thread gets own browser instance | Multi-user, isolated sessions |

---

_Consolidated from `BROWSER_PLANNING.md` and `BROWSER_SCREENCAST_ANALYSIS.md`_
