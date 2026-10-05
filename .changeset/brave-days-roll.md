---
'@mastra/playground-ui': patch
---

Improved tool approvals in Factory and Studio. Both now show the decision as a status badge beside the tool name and preview the complete file content before you approve. Pending requests stay expanded so the actions stay visible; once decided, Studio details can collapse without hiding the decision.

**Changed** `ToolApprovalActions` now renders only the Approve and Decline buttons and no longer accepts `status`. Render it only while the request is pending, and show the decision with the new `ToolApprovalStatus` beside the tool name.

Before:

```tsx
<ToolApprovalActions status={decision} toolName="write_file" onApprove={approve} onDecline={decline} />
```

After:

```tsx
<>
  <ToolApprovalStatus status={decision} />
  {!decision && <ToolApprovalActions toolName="write_file" onApprove={approve} onDecline={decline} />}
</>
```

`ToolApproval` renders both parts for you and now accepts `args` to preview the tool arguments.

**Removed** `ToolApprovalButtons` from `@mastra/playground-ui/domains/chat/tools/badges/tool-approval-buttons`. Wrap the tool's details in `ToolApprovalBadge` from `@mastra/playground-ui/domains/chat/tools/badges/tool-approval-badge` instead: it takes the tool's `BadgeWrapper` props plus the approval request, shows the status beside the tool name, and keeps the request expanded until it is decided. `ToolApprovalButtonsProps` is now `ToolApprovalRequest`.

Before:

```tsx
<BadgeWrapper title="Write file">
  {details}
  <ToolApprovalButtons {...request} />
</BadgeWrapper>
```

After:

```tsx
<ToolApprovalBadge title="Write file" approval={request}>
  {details}
</ToolApprovalBadge>
```
