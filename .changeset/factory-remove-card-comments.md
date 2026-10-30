---
'@mastra/factory': minor
'@mastra/playground-ui': patch
'mastracode': patch
---

Removed comments from Factory work items. Cards no longer have a comment feed, mentions, or comment counts, and the mention and activity items are gone from the attention inbox. Slack `aside` messages are still ignored by the agent but are no longer copied onto the card, and Factory no longer mirrors card comments to Slack.

Each card now has a single `description` instead. Set it with `description` on `POST /web/factory/projects/:id/work-items` and `PATCH /web/factory/work-items/:id` (a blank string clears it), or edit it from the card panel. Runs started on the card receive it in a `<work-item-description>` block after the skill instructions, in place of the old `<work-item-feed>` block.

Breaking changes for API and agent-tool callers:

- `factory_create_work_item` takes `description` instead of `brief`. `factory_update_work_item` also accepts `description`, and `factory_inspect_work_item` returns it in place of recent comments.
- The `/web/factory/work-items/:id/comments`, `/web/factory/projects/:id/mention-roster` and `/web/factory/projects/:id/feed-events` routes are removed.
- The `mention` and `activity` attention kinds are removed.
- Work items no longer include `commentCount` or `feedActivityAt`.
- Integrations can no longer declare a `feedPublisher`, and `IntegrationContext` no longer has `feed`.
- `factoryWorkItemUrl()` no longer accepts `commentId`.
