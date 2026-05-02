---
'@mastra/ai-sdk': minor
---

Emit native Harness plan approval request data from `harnessToUIMessageStream`.

When a Harness display state contains `pendingPlanApproval`, the AI SDK harness
bridge now emits a `data-mastra-plan-approval-request` chunk with the approval
id, plan id, title, and plan body. Tool approval behavior and the existing
Harness snapshot/delta HITL data are unchanged.

Usage:

```ts
for await (const chunk of harnessToUIMessageStream(harness, { include: ['hitl'] })) {
  if (chunk.type === 'data-mastra-plan-approval-request') {
    const { approvalId, planId, title, plan } = chunk.data;
    renderPlanApproval({ approvalId, planId, title, plan });
  }
}
```
