---
'@mastra/playground-ui': patch
---

The Knowledge graph no longer drops root scopes. With nothing focused it now draws up to 24 scopes as circles. Any more go in a "+N more scopes" circle, which draws the next batch when clicked and fetches more scopes from the server while the server still has some. Scopes that hold pages come first, then the most recently changed, so a scope that was just created still gets a circle. Root scopes past the first page of results now load when asked for, which they didn't before.
