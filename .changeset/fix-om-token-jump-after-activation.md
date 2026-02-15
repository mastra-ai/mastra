---
"@mastra/memory": patch
---

Fixed a bug where the OM context window would jump to extremely high token counts (e.g. 16k → 114k) after observation activation. Two issues were causing this:

- **Token counter included OM metadata parts**: `data-om-activation` marker parts (which contain the full observation text, up to 150k+ characters) were being counted as message tokens when loaded from the database. These parts are never sent to the LLM and are now skipped during token counting.

- **Marker duplication on messages**: Activation markers were being added to assistant messages twice — once by the AI SDK stream and once by the persistence layer — doubling every marker and compounding the token inflation. Both `persistMarkerToMessage` and `persistMarkerToStorage` now deduplicate by `type + cycleId` before adding a marker.
