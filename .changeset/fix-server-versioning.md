---
'@mastra/server': patch
---

Fix stored agents functionality:

- Fixed auto-versioning bug where `activeVersionId` wasn't being updated when creating new versions
- Added `GET /vectors` endpoint to list available vector stores
- Added `GET /embedders` endpoint to list available embedding models
- Added validation for memory configuration when semantic recall is enabled
- Fixed version comparison in `handleAutoVersioning` to use the active version instead of latest
- Added proper cache clearing after agent updates
