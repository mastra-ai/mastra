---
'mastracode': patch
---

Rebuilt the MastraCode web studio UI on the @mastra/playground-ui design system. Theme switching, settings, command palette, sidebar, and the conversation transcript now use shared design-system components for a consistent look and accessible controls, replacing the previous custom stylesheet, and the bespoke inline-SVG icon set was replaced with lucide-react icons (the decorative brand wordmark/logo was removed while preserving accessible labels).

Cleaned up the studio chrome: removed the duplicate top-level project switcher, theme toggle, and mode switcher from the header (the sidebar switcher is the single project switcher, the theme is set only from Settings), moved the Settings button into the sidebar footer, and moved the session mode selector into a single unified status row below the composer. The header is now reduced to just the mobile sidebar toggle. The chat message column, composer, and status line share the same `max-w-[80ch] w-full` column with container border/background removed so they align cleanly.

Simplified the chat message UI to match the Studio playground: user messages are plain right-aligned rounded bubbles (no "YOU" label or avatar) rendered as markdown, and assistant messages render as label-free full-width markdown prose.

Improved tool-call rendering: tool arguments, results, and full-file writes render through the design-system `CodeBlock` component (shiki highlighting, built-in copy, softer rounded shape) instead of plain monospace `<pre>` blocks. Consecutive tool calls now merge into a single bordered, rounded container with divider-separated full-width collapsible rows (no per-item stacked-card look), and the collapse control uses a standard chevron instead of a rotating icon.

Improved the "Open a project" dialog: the current path uses the shared breadcrumb component and navigating up a folder is a single click on a parent crumb; removed the double-click-to-select behavior and hint text so a single click browses and "Use this folder" selects.

Improved web session caching and settings refresh behavior.
