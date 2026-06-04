# Mastra Code feature map

## Purpose

Map Mastra Code by user-visible feature so agents can understand intended behavior, architecture, state ownership, and test coverage before changing code.

This is not an implementation-layer index. Start from what the user can do, then document the TUI/headless/runtime pieces that make that behavior work.

## Structure

Use feature-area folders with pages for concrete user behaviors:

```txt
features/
  threads/
    README.md
    create-thread.md
    switch-thread.md
    clone-thread.md
    restore-thread-state.md
  models/
    README.md
    select-model.md
    model-packs.md
    reload-preserves-model.md
  goals/
    README.md
    start-goal.md
    judge-loop.md
    pause-resume-clear.md
```

Prefer one page per behavior. Use normal relative Markdown links for related features.

## Required page sections

Copy [`_template.md`](./_template.md) for every feature page.

Every feature page must include:

- Origin PR / commit
- User-visible behavior
- Entry points / commands
- TUI states
- Headless / non-TUI behavior
- Streaming / loading / interrupted states
- Streaming vs loaded-from-history behavior
- State ownership
- Key files
- Dependencies / related features
- Existing tests
- Missing tests
- Known risks / regressions
- Verification checklist

## Rules for agents

- Treat existing pages as leads, not truth.
- Verify claims against code, git history, tests, and current runtime behavior.
- Link sideways to related feature pages instead of duplicating large sections.
- If a section is unknown, write `Unknown — needs verification`, not a guess.
- Keep pages focused on behavior; implementation details belong only where they explain that behavior.
