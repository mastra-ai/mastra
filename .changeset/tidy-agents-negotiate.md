---
'@mastra/server': patch
---

Negotiate hosted A2A discovery cards using the `A2A-Version` request header. Requests for `1.0` receive a v1 card advertising both supported JSON-RPC interfaces; missing or blank headers continue to receive the legacy v0.3 card. Discovery responses include `Vary: A2A-Version`, and configured signing covers the selected wire representation.
