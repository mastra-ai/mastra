---
'mastracode': patch
---

Fixed slash command arguments being silently discarded when the command template doesn't use $ARGUMENTS or positional variables ($1, $2, etc.). Arguments are now appended to the output so the model can see what the user provided.
