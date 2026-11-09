---
'@mastra/factory': minor
'mastra': patch
---

The board now decides what Factory does on its own. The project-wide **Auto-start runs** and **Self-review before pull requests** switches are gone: a phase starts its runs without approval when it has `autoStart` (optionally `autoStartWhen`), and a card is self-reviewed when its board has a self-review phase.

**Existing projects keep their behavior.** On the next load, Factory rewrites each project's stored boards once:

- A project with auto-run on gets `autoStart: true` on every working phase of every stored board.
- A project with self-review off loses the Work board's self-review phase and every move into it. If cards sit in that phase, Factory keeps it and logs a warning.

**API.** `PATCH /web/factory/projects/:id` still accepts `autoRunEnabled` and `selfReviewEnabled` for one more release and ignores them. Projects no longer return them. `autoApprovePlans`, ignored since the previous release, is now an unknown field: a request that sends only it is rejected.

```diff
- PATCH /web/factory/projects/:id          { "autoRunEnabled": true }
+ PATCH /web/factory/projects/:id/boards/work  (set "autoStart": true on the phases that should start on their own)
```

You can also set it in Settings → Work board.
