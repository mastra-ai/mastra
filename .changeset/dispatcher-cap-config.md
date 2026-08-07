---
'@mastra/factory': patch
---

Added `dispatcher.maxInFlight` to `MastraFactoryConfig` and the `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` deployment setting to configure the maximum number of concurrent Factory background dispatches per replica.

```sh
export MASTRACODE_DISPATCH_MAX_IN_FLIGHT=10
```
