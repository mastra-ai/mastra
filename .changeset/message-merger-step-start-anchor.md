---
'@mastra/core': patch
---

Assistant text parts are no longer reordered when two or more of them follow a tool call. `pushNewPart` injects a `step-start` ahead of the first text part after a tool invocation, inserting two parts where `addPartsToMessage`'s offset arithmetic assumed one, so every later part was placed one slot short and spliced in front of the part before it — rotating the run and persisting the reply out of order (`Hope that helps! Here is the answer.`). Because the reordering is written into `content.parts`, it survived to storage and was replayed to the model as history on every later turn. `pushNewPart` now reports how many parts it inserted and the walk tracks that drift.
