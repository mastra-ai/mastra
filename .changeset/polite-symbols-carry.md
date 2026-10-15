---
'@mastra/factory': minor
---

Added Factory tools to user sessions. When you work in your own session inside a Factory, its agent can now find and inspect work items (`factory_list_work_items`, `factory_inspect_work_item`), see what needs attention (`factory_list_attention`), file work items for you (`factory_create_work_item`), and edit a card's title, repository, parent or plan pre-approval (`factory_update_work_item`). It can also move items, retry failed runs, and approve or dismiss proposals.

Sessions can follow work items with `factory_subscribe_work_item` and `factory_unsubscribe_work_item`. Filing an item follows it automatically. These tools replace the separate Factory Supervisor, so you manage the Factory from the session you're already in.
