---
'@mastra/editor': minor
---

Added `scorers.judgeModel` to `MastraEditor` options, so you can choose the judge model for stored LLM-judge scorers. For example, give each judge its own API key:

```ts
new MastraEditor({
  scorers: {
    judgeModel: scorer => async () => ({
      id: `${scorer.model!.provider}/${scorer.model!.name}`,
      apiKey: await lookUpKeyFor(scorer.id),
    }),
  },
});
```
