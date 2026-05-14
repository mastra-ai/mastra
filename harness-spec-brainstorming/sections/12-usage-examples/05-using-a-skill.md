### 12.5 Using a skill

```ts
const result = await session.useSkill('summarize-pr', {
  args: {
    repo: 'mastra/mastra',
    prNumber: 4521,
    style: 'concise',
  },
  output: z.object({
    title: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    suggestedReviewers: z.array(z.string()),
  }),
});
// result.title, result.risk, result.suggestedReviewers all typed.
```
