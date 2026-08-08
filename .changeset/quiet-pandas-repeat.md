---
'@mastra/memory': minor
---

add instructionMode and continuationHints to observational memory

`observation.instruction` and `reflection.instruction` were append-only, so a domain
whose extraction needs differ from OM's defaults could only argue with the built-in
guidance from the end of the prompt. Both now accept
`instructionMode: 'append' | 'replace'`. In replace mode the custom instruction
substitutes the built-in extraction/consolidation guidance while OM keeps the persona,
output format, and guidelines, so the parsing contract is unchanged. The Reflector is
also told the extraction guidance the Observer is actually running under.

`observation.continuationHints` and `reflection.continuationHints` control whether the
`<current-task>` and `<suggested-response>` sections are produced. Pass `false` to
disable both or an object to disable either individually — useful when the agent drives
its own control flow and should not be steered by memory. Prompts now name only the
continuation sections they actually define.

Both options default to current behaviour.
