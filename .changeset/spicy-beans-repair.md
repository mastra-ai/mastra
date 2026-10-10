---
'@mastra/cloudflare': patch
---

Added the new signal subscription tables to the Cloudflare KV storage types. Workers bindings now need three more KV namespaces: `mastra_signal_subscriptions`, `mastra_signal_subscription_deliveries`, and `mastra_signal_subscription_coordination`. Cloudflare storage doesn't implement the `signalSubscriptions` domain.
