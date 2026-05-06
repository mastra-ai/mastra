---
'@mastra/playground-ui': minor
---

Added role-based semantic font tokens so consumers can swap fonts in one declaration. Components now reference `--font-display` (headlines, brand) and `--font-body` (UI, paragraphs) instead of type-based `--font-sans` / `--font-serif`. Existing utilities keep working through backward-compat aliases.

**Override fonts in your app**

```css
:root {
  --font-display: 'Greed', ui-serif, Georgia, serif;
  --font-body: 'Geist', system-ui, sans-serif;
  --font-mono: 'GeistMono', ui-monospace, monospace;
}
```

**Removed raw font-name vars** — `var(--geist-mono)`, `var(--font-inter)`, `var(--tasa-explorer)`. Code components that referenced these directly (e.g. `<CodeEditor>`, `<CodeDiff>`) now resolve through `var(--font-mono)` so a single token override propagates to every code surface.

The package no longer ships font files — defaults are system fonts. Bring your own fonts via `@font-face` in your app and override the tokens above.
