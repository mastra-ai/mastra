---
'mastracode': patch
---

The published `mastracode` package is now terminal-only. The in-development web
UI is kept in the repository for local development but is no longer wired into
the CLI and is excluded from the published package, so installs stay lean and
ship only the TUI.

Internally, harness startup is shared through a single base factory with small
per-environment helpers, so the terminal app and the local web server build the
exact same harness without duplicating wiring.
