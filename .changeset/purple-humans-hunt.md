---
'@mastra/playground-ui': minor
---

Added role-based semantic font tokens so consumers can swap fonts in one declaration. Components now reference `--font-display` (headlines, brand) and `--font-body` (UI, paragraphs) instead of type-based `--font-sans` / `--font-serif`. Existing utilities keep working through backward-compat aliases (`--font-sans` → `--font-body`, `--font-serif` → `--font-display`).

**Override fonts in your app**

```css
:root {
  --font-display: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'Commit Mono', ui-monospace, monospace;
}
```

**Backward-compat for existing consumers** — the legacy raw font-name vars `--geist-mono`, `--font-inter`, `--tasa-explorer` continue to resolve via aliases to the semantic tokens, so any `font-family: var(--geist-mono)` keeps working without code changes. New code should reference `var(--font-mono)` directly.

The package no longer ships font files — defaults are system fonts. Bring your own fonts via `@font-face` in your app and override the tokens above.
