---
'@mastra/code-sdk': minor
---

Added native Google Vertex AI model support using Application Default Credentials. Configure `GOOGLE_VERTEX_PROJECT` and `GOOGLE_VERTEX_LOCATION`, then select a Vertex model in a mode:

```ts
const code = await createMastraCode({
  modes: [{ id: 'build', name: 'Build', default: true, defaultModelId: 'google-vertex/gemini-3.8-flash' }],
});
```
