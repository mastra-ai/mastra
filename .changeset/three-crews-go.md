---
'mastracode': minor
---

Added interactive API key prompt when selecting a model without a configured key. When you choose a model from the model selector that lacks an API key, Mastra Code now displays a dialog to enter the key. The key is stored persistently in auth.json and loaded into the environment on subsequent startups. Environment variables always take priority over stored keys. Press Escape to dismiss the prompt and keep the previous behavior.
