# 0004: Navigation uses the link variant

**Decision**: a control that takes the user somewhere, instead of doing something on the current page, is `Button variant="link"` with the link element in `render`. It is never a `ghost` or `default` button. A link that stays in the app ends in `ChevronRightIcon`; a link that leaves it ends in `ExternalLinkIcon`.

**Scope**: in-page navigation such as "View usage", "See all", and "Open in Studio"; reference links in the breadcrumb bar such as Docs; external links, with an `ExternalLink` end icon. Actions that create, change, run, or delete keep the button variants in `rules/controls.md`. Breadcrumbs, tabs, and sidebar items keep their own components.

**Why**: a ghost button looks like an action and paints a fill on hover, so a link styled that way promises something will happen on this page. A link variant with a real anchor reads as navigation, is announced as a link, and opens in a new tab on Cmd-click.

**Evidence**: `Button` gained the `link` variant in PR [#26574](https://github.com/mastra-ai/mastra/pull/26574), commit `1bb55e3`. The comment above `isLinkElement` in `src/ds/components/Button/Button.tsx` explains why a link renders as an anchor rather than inside a button: "A link is not a button." Existing use: `src/domains/chat/tools/mcp-input-request-tool.tsx`. Decided by a frontend code owner on review of the billing example, 2026-11-06.

**Rejected**: `variant="ghost" size="sm"` for header links, the previous guidance in `rules/page-frame.md`, which looked like an action and showed a filled hover.

**Supersedes**: the breadcrumb-bar rule that reference links are ghost buttons.

**Approved by**: Justin Levine (`@jal-co`), 2026-11-06.

**Reaches**: `rg -n 'variant="ghost"[^>]*(render=\{<(Link|a) |to=|href=)' packages mastracode`
