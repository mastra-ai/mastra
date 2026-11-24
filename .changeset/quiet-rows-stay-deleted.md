---
'@mastra/memory': patch
---

Fixed Observational Memory bringing back a message you deleted. When a message that already carried a completed observation boundary was resaved after its row had been removed from storage, the save re-created the row. Boundary resaves, turn-end saves, step drains and processor finalization fallbacks now check memory-source holders against storage before saving; new inputs and outputs remain eligible for their first save. The check reads the stored row just before saving, so a message deleted in the instant between that check and the save can still be re-created.

This does not cover the separate marker writers (`ObservationalMemory.persistMarkerToMessage`, `persistMarkerToStorage`, and the `ObservationStrategy` helpers `attachMarker`, `persistMarkerToStorage`, and `persistMarkerToMessage`) or async buffering's seal writes (`ObservationStep`'s memory adapter save and `ObservationalMemory.bufferObservationChunk`). Those existing paths can still resave a stored message deleted mid-turn and need a separate follow-up.
