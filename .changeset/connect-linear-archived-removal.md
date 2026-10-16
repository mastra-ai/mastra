---
'@mastra/connect': patch
---

Fixed the Linear Knowledge importer leaving records behind for archived or trashed documents. Linear's document list omits them, so the importer now checks each imported document directly and removes its records once Linear reports it archived or trashed.
