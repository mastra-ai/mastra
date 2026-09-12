---
'@mastra/playground-ui': patch
---

Moved the tool-call classifier and grouping helpers (toolCardKind, badgeStatus, toolInteraction, collectToolGroups) and the first self-contained tool badges (ToolApprovalButtons, AskUserBadge, AskUserTool, CodeModeBadge) into playground-ui so hosts can render approval, ask-user and code-mode tool calls without depending on Studio internals.
