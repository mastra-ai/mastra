---
'@mastra/factory': patch
---

Factory servers now start listening right away instead of waiting for the one-time move of existing sessions to their new memory owners. On a large or remote database that step could take minutes to an hour, with no output, so `mastra factory dev` looked stuck. The move now runs in the background, logs how many sessions it is moving, and reports progress every 10 seconds. Sessions that haven't been moved yet keep working as before.
