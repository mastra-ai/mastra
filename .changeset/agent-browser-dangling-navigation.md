---
'@mastra/agent-browser': patch
---

Fixed an unhandled promise rejection that could crash the whole Node process when a `waitUntil` navigation wait timed out while the associated `click`, `press`, or `select` action was still pending. The navigation wait is started before the action and shares its timeout, so a slow or blocked action always let the navigation rejection fire first with no handler attached. The rejection is now observed by a pre-attached noop handler, while `await navigation` still surfaces the original error through the existing error handling.
