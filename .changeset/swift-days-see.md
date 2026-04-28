---
'@mastra/playground-ui': minor
---

Added shared `ThemeProvider`, `useTheme`, and `ThemeToggle` to unify theme management.

**Added**

- `ThemeProvider` applies the resolved theme class to `<html>` and persists the choice under the shared `mastra-theme` localStorage key, with a one-time migration from previously stored preferences.
- `useTheme()` works without a `<ThemeProvider>` ancestor: it returns a read-only fallback that tracks the OS color scheme and exposes a no-op `setTheme`, so theme-aware leaf components (e.g. `CodeDiff`, `CodeEditor`) keep working when embedded standalone.
- `ThemeToggle` renders a system/light/dark pill and supports both controlled and uncontrolled usage.
