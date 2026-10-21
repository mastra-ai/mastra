---
'mastra': minor
---

Added saved views to the Studio **Traces** page. Save the current filters, time range, sort and columns as a named view with **Create new view…**, switch between views from tabs above the filter bar, and use **Save to this view** or **Reset changes** after editing one. Views are stored in your Mastra storage (`@mastra/pg`, `@mastra/libsql`, `@mastra/mongodb`, `@mastra/mysql` or `@mastra/spanner`) and shared by everyone who can open Studio. Switching views or leaving the page with unsaved changes asks first. Saved views stay hidden when the storage doesn't support them.

The Traces filter bar now shows filters your storage can't run, such as AND/OR groups, as muted chips with the reason instead of hiding them. They don't filter the list, stay in a view when you save it, and can be removed.
