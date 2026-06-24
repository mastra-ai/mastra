---
'mastracode': patch
---

Fixed the `mastracode web` server creating a second, redundant Mastra instance.
The browser and terminal versions now share a single Mastra and storage, so
threads, memory, and observability stay consistent regardless of which one you
use.

Internally, startup is now split into a shared base factory plus small
per-environment helpers, so the local terminal app and the web server build the
exact same harness without duplicating wiring.
