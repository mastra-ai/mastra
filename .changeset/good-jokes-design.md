---
'mastra': minor
---

Added saved views to the Studio **Traces** page. Click **New view** to start a view from the current time range, sort and columns, add filters, then click **Save view**. Views show as tabs above the filter bar, and after editing one you can **Save changes** or **Reset**. **All traces** brings back the filters you had before opening a view.

Views are stored in your Mastra storage (`@mastra/pg`, `@mastra/libsql`, `@mastra/mongodb`, `@mastra/mysql`, `@mastra/mssql` or `@mastra/spanner`) and shared between users. Switching views or leaving the page with unsaved changes asks first, and deleting a view asks for confirmation. Saved views stay hidden when the storage doesn't support them.

The Traces filter bar now shows filters your storage can't run, such as AND/OR groups, as muted chips with the reason instead of hiding them. They don't filter the list, stay in a view when you save it, and can be removed.
