---
'mastracode': patch
---

Add per-category tool permissions to the MastraCode Web Settings modal.

The Settings → Behavior tab previously only had the blunt "Auto-approve tools"
(YOLO) toggle. It now also has a **Tool permissions** section with an
allow / ask / deny control for each tool category (read, edit, execute, mcp,
other), backed by the existing `getPermissions` / `setPermissionForCategory`
harness routes. This brings the web app to parity with the TUI's `/permissions`
command, which had no settings-modal equivalent.

This came out of an audit of every web slash command: each one was checked for
whether it represents a setting and, if so, whether the Settings modal already
covered it. Everything else was already covered (model, thinking level,
yolo, notifications, smart editing, observational memory, model packs, API keys,
custom providers) or is an action/informational command (new, rename, delete,
clone, goal, follow-up, abort, cost, om phase, help) rather than a setting. The
only genuine gap was per-category permissions, which this fills.
