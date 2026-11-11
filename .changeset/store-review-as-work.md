---
'@mastra/factory': patch
---

Factory now stores cards left on the retired Review board as Work cards once, in the background after boot (the `review` phase becomes `pr-review`). Projects stop checking their Review board on every card read and write. Reads still translate any legacy rows until the pass has run.
