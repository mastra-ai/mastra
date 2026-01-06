---
'@mastra/pg': patch
---

PostgresStore was setting `this.stores = {}` in the constructor and only populating it in the async `init()` method. This broke Memory because it checks `storage.stores.memory` synchronously in `getInputProcessors()` before `init()` is called.

The fix moves domain instance creation to the constructor. This is safe because pg-promise creates database connections lazily when queries are executed.
