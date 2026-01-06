---
'@mastra/convex': patch
---

Convex storage and vector adapter improvements:

- Refactored to use typed Convex tables for each Mastra domain (threads, messages, resources, workflows, scorers, vectors)
- All tables now include `id` field for Mastra record ID and `by_record_id` index for efficient lookups
- Fixed 32k document limit issues by using batched operations and indexed queries
- Updated `saveMessages` and `updateMessages` to automatically update thread `updatedAt` timestamps
- Fixed `listMessages` to properly fetch messages from different threads when using `include`
- Fixed `saveResource` to preserve `undefined` metadata instead of converting to empty object
- Rewrote `ConvexAdminClient` to use Convex HTTP API directly with proper admin authentication
- Added comprehensive documentation for storage and vector adapters
- Exported pre-built table definitions from `@mastra/convex/server` for easy schema setup
