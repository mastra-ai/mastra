---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed file and image attachments rendering blank in the Studio chat. Streamed agent files/images and user-uploaded images now display correctly — the chat renderer reads the `mediaType`/`url` shape the SDK produces, with a fallback to the persisted `mimeType`/`data` so reloaded threads keep working.
