---
'@mastra/server': patch
---

The Editor's "enhance instructions" action no longer fails with "No model with a configured API key found" for agents whose model is a directly constructed AI SDK instance, such as `openai('gpt-4o')`. Only gateway/router models now need their provider API key set for the endpoint to pick them; explicit model instances are used as-is. Agents whose only model is a router id still return the 400 about a missing provider key when nothing is connected.
