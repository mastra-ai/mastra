---
'@mastra/factory': patch
---

The attention inbox now reports counts and the newest item per kind, and the UI decides what interrupts a person. Runs waiting for approval leave the sidebar badge and the notification sound; the sidebar popover lists them under an "Approvals" tab beside "Needs you" and "Activity", each tab carrying its unread count, and the inbox page files them under "Waiting for approval", above "Activity".

Breaking for callers of `GET /web/factory/projects/:id/attention`:

- the `tier` query is gone; ask for the kinds you want with a repeatable `kind` query, or omit it for every kind
- `openCount`, `badgeCount`, `unreadCount` and the three `latestOccurrence*` fields are gone; read `kinds[kind].open`, `kinds[kind].unread` and `kinds[kind].latest` instead. `kinds` always covers every kind, whatever `kind` filter the items use

Before:

```ts
const inbox = await fetch(`${base}/attention?tier=badge`).then(r => r.json());
inbox.badgeCount; // unread across the badge kinds
inbox.latestOccurrenceAt; // newest badge item
```

After:

```ts
const query = new URLSearchParams([['kind', 'mention'], ['kind', 'automation-failed']]);
const inbox = await fetch(`${base}/attention?${query}`).then(r => r.json());
inbox.items; // mentions and failed automations only
inbox.kinds.mention.unread + inbox.kinds['automation-failed'].unread; // the badge number
inbox.kinds.mention.latest?.at; // newest mention, or null
```
