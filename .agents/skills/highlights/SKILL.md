---
name: highlights
description:
  Use when an app uses @pierre/highlights to generate syntax-highlighted HTML or
  tokens, stream code, incrementally tokenize edits, or apply Zed-compatible
  themes and CSS variables.
---

# `@pierre/highlights`

Use `@pierre/highlights` for standalone syntax highlighting with built-in
WebAssembly lexers. Choose HTML for a complete code block, tokens for a custom
renderer, `StreamTokenizer` for append-only input, or `LiveTokenizer` for an
editable document.

## Install

```bash
pnpm add @pierre/highlights
```

Import from `@pierre/highlights`. Conditional exports initialize WebAssembly
automatically for Node.js, browsers, and Cloudflare Workers. Highlighting is
synchronous after import; ordinary usage needs no `init()` or language
registration.

## Select a reference

| Task                                                                       | Reference                                 |
| -------------------------------------------------------------------------- | ----------------------------------------- |
| Generate HTML or tokens, validate a language, or manage a Wasm module      | [Rendering](references/rendering.md)      |
| Load or customize themes, switch CSS variables, or render multiple schemes | [Themes](references/themes.md)            |
| Tokenize streamed strings or bytes                                         | [Streaming](references/streaming.md)      |
| Apply edits, prioritize a viewport, or read packed token records           | [Incremental editing](references/live.md) |

For file, diff, or editor components, read the [diffs skill](../diffs/SKILL.md).
