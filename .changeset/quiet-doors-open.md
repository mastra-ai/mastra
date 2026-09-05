---
'@mastra/factory': patch
---

The factory supervisor can now file work items on a person's behalf. A new approval-free, audited `factory_create_work_item` tool takes a title and a brief, enters the card through intake like the board does (the brief lands as the card's first comment for the worker to read), and records who asked. On an authenticated turn the card is filed as that person; on a notification-woken turn it is filed as the supervisor's agent identity with no requester. The supervisor then drives the item the way it drives everything else: watching its findings, answering its worker's questions, and escalating what needs a person. It never assigns, schedules, or codes the work itself.
