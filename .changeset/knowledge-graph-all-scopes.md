---
'@mastra/playground-ui': patch
---

The Knowledge graph no longer drops root scopes. With nothing focused it now draws up to 24 scopes as circles and counts any more in a "+N more scopes" circle, which shows the next batch when clicked. Scopes that hold pages come first, then the most recently changed, so a scope that was just created still gets a circle.
