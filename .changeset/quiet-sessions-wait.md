---
'@mastra/factory': patch
---

Fixed new sessions starting their own environment build after every push. When a Factory builds its environment on push, a new session now starts from the environment the Factory last built, so builds only start as often as the push debounce allows. The session still checks out the newest commit.
