---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state.
