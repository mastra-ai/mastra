---
'@mastra/factory': patch
---

Fixed removing a saved API key in local mode. The provider used to stay connected until the server restarted, because the key stayed in the server's environment. It now disconnects right away.
