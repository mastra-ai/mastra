---
'@mastra/core': minor
---

Added an optional `accessibility` part to `SandboxComputer`. When a workspace sandbox's computer exposes it, the workspace also emits `mastra_workspace_computer_accessibility_tree`, `mastra_workspace_computer_accessibility_act` and `mastra_workspace_computer_accessibility_set_text`, so agents can read a desktop's control tree and operate controls by ref instead of by pixels. New exports: `supportsComputerAccessibility`, `AccessibilityRefError` and the accessibility types.
