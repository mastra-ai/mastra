# Browser Workspace — Known Issues

Tracking issues found during manual testing. Resolve as needed.

---

## Issue 1: Two tabs open on browser launch, only one tracked

**Status:** Deferred
**Severity:** Minor (cosmetic)

**Observed:**
When the browser launches (headed mode), Chrome opens with two tabs:

1. "New Tab" (`chrome://newtab/`) — Chrome's default from the user profile
2. `about:blank` — Playwright's initial page

`agent-browser tab list` only shows `about:blank` (filters `chrome://` URLs).
CDP `/json/list` confirms both page targets exist.

**Root cause:**
This is Chrome + Playwright `launchPersistentContext` behavior. Chrome always opens
its profile's default "New Tab" page alongside Playwright's `about:blank`. Both
`agent-browser open --headed` and `agent-browser get cdp-url --headed` produce
the same result. Not something we can fix on our side.

**Additional finding:**
`launchBrowserViaCLI()` in `viewer.ts` runs `agent-browser open --headed` (no URL),
which errors (`Missing arguments for: open`) but the daemon starts as a side effect.
Could be cleaner to use `getCdpUrlArgs` (`get cdp-url`) instead, but:

- `browser-use` doesn't support `get cdp-url` (uses process discovery)
- Both commands produce the same two-tab result anyway

**Impact:**

- User sees two tabs in the headed browser window but only one is tracked
- Not a functional issue — `chrome://newtab` is correctly ignored
- Our viewer already prefers non-chrome:// pages as the active target (line 1079)

**Next steps:**

- Revisit after all other issues are resolved for both agent-browser and browser-use
- Consider making `launchBrowserViaCLI` use `getCdpUrlArgs` where available
- Could file an issue on `vercel-labs/agent-browser` suggesting a `--no-new-tab` flag

---

## Issue 2: No screencast after close/reopen until thread switch

**Status:** Fixed (a68e146)
**Severity:** Medium (UX)

**Observed:**

1. Open browser, screencast works fine
2. Close browser (`agent-browser close`)
3. Reopen browser (`agent-browser open google.com`)
4. Screencast does NOT show — just blank/stale
5. Switch to another thread and back → screencast appears

**Root cause:**
`handleDisconnect()` in `viewer.ts` nulled the CDP client and called
`notifyBrowserClosed()`, but never restarted polling for browser availability.
The polling was only started once during `onBrowserReady()` registration and
stopped after the initial connection succeeded. After disconnect, nobody was
watching for the browser to come back.

The ViewerRegistry was correctly set up — it had `onBrowserReady` callbacks
that persist across restarts (confirmed by line 1102 in `browser.ts`). The
callbacks just never fired because `notifyBrowserReady()` was never called
on reconnect, because reconnect never happened.

**Fix:**

- `handleDisconnect()` now calls `startPollingForBrowser()` to resume polling
- Also clears stale shared state (pageTargets, activeTargetId, screencastStream)
  so reconnect starts with fresh target tracking

**Flow after fix:**

1. Browser closes → CDP `close` event → `handleDisconnect()`
2. `notifyBrowserClosed()` → ViewerRegistry shows "browser closed" overlay
3. `startPollingForBrowser()` begins polling every 1s
4. Agent reopens browser → polling `connect()` succeeds
5. `notifyBrowserReady()` → ViewerRegistry starts new screencast

---

## Issue 3: (Template for new issues)

**Status:** —
**Severity:** —

**Observed:**

**Impact:**

**Likely cause:**

**Next steps:**
