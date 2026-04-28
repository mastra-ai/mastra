---
'@mastra/playground-ui': minor
---

Add shared ThemeProvider, useTheme, and ThemeToggle to unify theme management.

ThemeProvider applies the resolved theme class to `<html>`, persists the choice to localStorage under a shared `mastra-theme` key (with one-time migration from the legacy zustand-persist envelope), and tracks system color-scheme changes when theme is `system`.

`useTheme()` is safe to call without a `<ThemeProvider>` ancestor: when no provider is mounted it returns a read-only fallback that tracks the OS `prefers-color-scheme` and exposes a no-op `setTheme`. This keeps theme-aware leaf components (e.g. `CodeDiff`, `CodeEditor`) working when consumers embed them without mounting the provider.

ThemeToggle renders the standard 3-segment system/light/dark pill via Radix RadioGroup; it supports both uncontrolled (auto-wires to ThemeProvider) and controlled modes for apps with custom theme handling.
