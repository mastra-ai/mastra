---
'@mastra/core': minor
'@mastra/stagehand': patch
---

Fixed the browser failing with `ECONNREFUSED` when launched again on a profile it had used before.

Before launching Chrome on a local profile, Mastra now clears the launcher logs left by earlier launches (`chrome-err.log`, `chrome-out.log`), which made the next launch connect to the old, dead DevTools port. It also removes a Chrome profile lock left by a browser that is no longer running. Stagehand does this for every thread-scoped browser too, not only on the first launch. Remote browsers (`cdpUrl`, Browserbase) are not affected.

If a browser that is still running holds the profile, launch now fails with a `BrowserProfileInUseError` that names the profile and the holding process:

```ts
import { BrowserProfileInUseError } from '@mastra/core/browser';

try {
  await browser.launch();
} catch (error) {
  if (error instanceof BrowserProfileInUseError) {
    // Another Chrome is using the profile: close it, or use a different profile.
    console.error(error.message);
  }
  throw error;
}
```

Added `browser.retire()` and `browser.killProcesses()` for code that replaces one browser with another. `close()` lets the browser relaunch the next time something uses it; `retire()` closes it for good, so a tool call still holding the old browser gets an error instead of starting an untracked Chrome. `killProcesses()` force-kills the browser's processes when `close()` fails or hangs. It works on macOS and Linux; it cannot force-kill Chrome on Windows.

A browser that finishes closing after another browser took its profile no longer deletes the new browser's lock.
