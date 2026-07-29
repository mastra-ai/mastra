---
'@mastra/playground-ui': minor
---

Added match navigation to the code and trace search in Studio. Searching inside a span now highlights every match, marks the current one, and lets you step through matches with Enter and Shift+Enter or the next and previous buttons, with a current/total counter.

The navigation mechanics are exposed for reuse as a generic `useMatchNavigation` hook (active index, wraparound, Enter/Shift+Enter and optional arrow keys) and a `MatchNav` counter/prev-next component, so other searches in the app can adopt the same behavior.
