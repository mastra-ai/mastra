---
'@mastra/playground-ui': patch
---

Restyled `MainSidebar` and swapped sidebar icons to the new Figma design system set.

- Section titles are larger and medium-weight (`text-ui-sm`, `font-medium`), lowercase, muted — replacing the previous uppercase + wide-tracking treatment. Underline divider beneath the title removed in both expanded and collapsed states. Active indicator bar on the left edge removed.
- Nav items render flush: icons align horizontally with the section title, hover/active state now uses theme-aware sidebar surface tokens without item borders or shadows. The legacy `indent` option is still accepted but no longer changes layout.
- New sidebar icons: `WorkspacesIcon`, `RequestContextIcon`, `ScorersIcon`, `DatasetsIcon`, `ExperimentsIcon`, `MetricsIcon`. Existing icons `AgentIcon`, `PromptIcon`, `WorkflowIcon`, `ProcessorIcon`, `McpServerIcon`, `ToolsIcon`, `LogsIcon`, `TraceIcon` updated to match the Figma artwork. All icons accept `React.SVGProps<SVGSVGElement>` and inherit color via `currentColor`.
