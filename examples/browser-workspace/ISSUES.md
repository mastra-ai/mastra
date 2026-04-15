# Browser Workspace — Known Issues

Tracking issues found during manual testing. Resolve as needed.

---

## Issue 1: Two tabs open, only one tracked

**Status:** Open
**Severity:** Minor (cosmetic)

**Observed:**
When running `agent-browser open google.com`, Chrome opens with two tabs:
1. "New Tab" (`chrome://newtab`)
2. Google (`https://www.google.com/`)

But `agent-browser tab list` only shows one tab (Google). The "New Tab" is not tracked.

**Impact:**
- User sees two tabs in the browser window but the agent only knows about one
- Not a functional issue — the untracked tab is just `chrome://newtab`

**Likely cause:**
`agent-browser` CLI filters out non-injectable URLs like `chrome://newtab`. This may be intentional behavior from the CLI side.

**Next steps:**
- Check if `agent-browser` has a flag to suppress the initial new tab
- Or check if Chrome can be launched without the default new tab
- Low priority — doesn't affect functionality

---

## Issue 2: No screencast after close/reopen until thread switch

**Status:** Open
**Severity:** Medium (UX)

**Observed:**
1. Open browser, screencast works fine
2. Close browser (`agent-browser close`)
3. Reopen browser (`agent-browser open google.com`)
4. Screencast does NOT show — just blank/stale
5. Switch to another thread and back → screencast appears

**Impact:**
- User has to switch threads to see the screencast after reopening
- Browser is actually running and functional, just no visual feedback

**Likely cause:**
ViewerRegistry subscribes to screencast when the browser starts. When the browser is closed, the CDP connection drops and screencast stops. When reopened, the ViewerRegistry may not know to re-subscribe because:
- The `isBrowserRunning()` check may still return stale state
- The `onBrowserReady` event may not fire again for the same thread
- The thread switch triggers a fresh `startScreencast` call which works

**Investigation areas:**
- `packages/core/src/browser/viewer.ts` — `doLaunch` / reconnect flow
- `packages/server/src/server/handlers/browser-stream.ts` — ViewerRegistry subscription
- How does `isBrowserRunning()` get updated after close/reopen?
- Does the workspace tool handler emit a "browser ready" event after reopen?

---

## Issue 3: (Template for new issues)

**Status:** —
**Severity:** —

**Observed:**


**Impact:**


**Likely cause:**


**Next steps:**

