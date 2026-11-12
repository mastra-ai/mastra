---
'@mastra/factory': patch
---

Factory servers no longer wait for a pass over every active run binding before they finish booting. The decision dispatcher already runs that catch-up in the background on its first tick, so boot stops being held for it. With a few hundred active bindings this took over a minute, which pushed deploys past their health check and left new instances unauthenticated for longer.
