---
'@mastra/core': patch
---

Fixed DurableAgent and EventedAgent runs to surface errors thrown by tool toModelOutput mappers instead of continuing with raw results. https://linear.app/kepler-crm/issue/COR-1324
