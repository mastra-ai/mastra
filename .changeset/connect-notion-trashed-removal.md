---
'@mastra/connect': patch
---

Fixed the Notion importer leaving Knowledge records behind for pages and databases moved to the Notion trash. Notion search omits trashed items, so the importer now checks previously imported pages and databases directly and removes their records once Notion reports them archived or in trash.
