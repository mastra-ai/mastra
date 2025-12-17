---
'@mastra/express': patch
'@mastra/hono': patch
---

Add HonoApp interface to eliminate `as any` cast when passing Hono app to MastraServer. Users can now pass typed Hono apps directly without casting.

Fix example type issues in server-adapters