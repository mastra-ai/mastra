---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
'@mastra/playground-ui': patch
---

Added human-in-the-loop (HITL) tool approval support for `generate()` method.

Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

**Using tool approval with generate()**

```typescript
const output = await agent.generate("Find user John", {
  requireToolApproval: true,
});

// Check if a tool is waiting for approval
if (output.finishReason === "suspended") {
  console.log("Tool requires approval:", output.suspendPayload.toolName);
  
  // Approve the tool call
  const result = await agent.approveToolCallGenerate({
    runId: output.runId,
    toolCallId: output.suspendPayload.toolCallId,
  });
  
  console.log(result.text);
}
```

**Declining a tool call**

```typescript
if (output.finishReason === "suspended") {
  const result = await agent.declineToolCallGenerate({
    runId: output.runId,
    toolCallId: output.suspendPayload.toolCallId,
  });
}
```

**New methods added:**

- `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
- `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

**Server routes added:**

- `POST /api/agents/:agentId/approve-tool-call-generate`
- `POST /api/agents/:agentId/decline-tool-call-generate`

The playground UI now also supports tool approval when using generate mode.
