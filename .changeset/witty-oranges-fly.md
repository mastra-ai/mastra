---
'@mastra/memory': patch
---

Fix memory pagination not working when using query() method

The Memory.query() method was ignoring pagination parameters in the selectBy option, always returning all messages instead of the requested page. This fix ensures pagination works correctly by using storage.getMessagesPaginated() when pagination is requested, while maintaining backward compatibility with storage.getMessages() for non-paginated queries.
