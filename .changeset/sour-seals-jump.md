---
'@mastra/playground-ui': minor
---

Added shared tool approval cards and actions for Factory and Studio, with consumer-controlled decisions and pending states.

Use `ToolApproval` for standalone requests or `ToolApprovalActions` inside existing tool details. Both are exported from `@mastra/playground-ui/components/ai/tool-approval`.

```tsx
<ToolApproval
  toolName="write_file"
  disabled={isSubmitting}
  onApprove={() => approve(toolCallId)}
  onDecline={() => decline(toolCallId)}
>
  <pre>{JSON.stringify(args, null, 2)}</pre>
</ToolApproval>
```

Pass `status="approved"` or `status="declined"` to display a recorded decision and disable both actions. Approval requests and their lifecycle stay in the consuming app.
