---
'@mastra/factory': minor
'mastra': patch
---

The board now decides what Factory does on its own. The project-wide **Auto-start runs** and **Self-review before pull requests** switches are gone: a phase starts its runs without approval when it has `autoStart` (optionally `autoStartWhen`), and a card is self-reviewed when its board has a self-review phase.

**Existing projects keep their behavior.** On the next load, Factory rewrites each project's stored boards once:

- A project with auto-run on gets `autoStart: true` on every working phase of every stored board.
- A project with self-review off loses the self-review phase of every stored board (Work, app and custom), with every move into it. Factory keeps the phase and logs a warning when an app board declares it in code (`defineBoard()`), when cards sit in it, when the board's build phase can't move to its pull request review without it, or when it is another phase's only move.

Every board the project stores is rewritten, app boards included: Factory serves a project the stored row, not the code. Boards are only served from code, unmigrated, when the boards storage domain is unavailable.

**API.** `PATCH /web/factory/projects/:id` still accepts `autoRunEnabled` and `selfReviewEnabled` for one more release and ignores them. Projects no longer return them. `autoApprovePlans`, ignored since the previous release, is now an unknown field: a request that sends only it is rejected.

Instead of `{ "autoRunEnabled": true }`, set `autoStart` on the phases that should start on their own, in Settings → Work board or with `PATCH /web/factory/projects/:id/boards/work`, sending the board's phases and the `expectedRevision` you read.
