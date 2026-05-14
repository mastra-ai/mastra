### 12.10 Cross-session orchestration

Spawn a child session for a one-shot job without disturbing the parent conversation.

```ts
async function runBackgroundAnalysis(parent: Session, document: string) {
  const child = await harness.session({
    resourceId: parent.resourceId,
    parentSessionId: parent.id,
    threadId: { fresh: true },
  });

  try {
    return await child.message({
      content: `Analyze this document and return findings:\n\n${document}`,
      output: AnalysisSchema,
      sync: true, // typed extraction → fresh runId, clean turn boundary
    });
  } finally {
    await child.close();
  }
}
```
