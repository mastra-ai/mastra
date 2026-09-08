---
'@mastra/factory': patch
---

Added approval-free, audited `factory_create_work_item` for authenticated supervisor chat. Cards enter intake with the requesting person as creator and their brief as the first comment, including their display name and avatar when available.

Ask the supervisor to file work, for example: "File a card titled Fix login, with the brief: Preserve the return URL when login succeeds." The supervisor can call:

```json
{ "title": "Fix login", "brief": "Preserve the return URL when login succeeds." }
```

The governed creation helper and its input/outcome types are available from `@mastra/factory/work-item-create`. `createFactoryWorkItem` shares the HTTP route's board-entry and preparation cleanup behavior; callers own their audit events.
