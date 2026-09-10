---
'@mastra/factory': minor
---

Added the ability to edit an existing custom model pack in Factory settings. Custom packs can now be renamed and their model assignments changed in place instead of having to remove and re-create them, and the active default pack stays selected across a rename.

The `POST /web/config/model-packs` route accepts an optional `previousId` — the id of the pack being edited — so a saved pack is updated in place, keeping its original id and timestamps. Renaming onto a name already owned by a different pack returns a `409`.