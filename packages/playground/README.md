# Studio layout composition

Mobile uses one app header for the route breadcrumb, app menu, contextual navigation and search. `PageLayoutHeaderContext` lets `MobilePageHeader` portal the original route-owned controls into stable `MobileHeaderProvider` slots without losing entity context. Parent links collapse into compact back navigation; longer paths remain available in a parent-pages popover. Page actions use the shared Popover and stay mounted while closed, so feature gates and shortcuts remain active. Empty action groups hide their trigger. Desktop keeps the page header above the main pane. Routes should continue supplying `PageLayout` breadcrumbs and actions rather than adding mobile bars.

Studio routes share `RootLayout`, `FeatureWorkspaceLayout` and `Layout`, which provide authentication,
keyboard navigation, the application frame, the desktop icon rail, and the mobile
navigation drawer. Navigation destinations share `useStudioNavigation` so
permissions, CMS availability, and platform restrictions apply consistently.

The router selects contextual navigation through pathless layouts:

- `StudioShell` leaves pages without contextual navigation full width.
- `StudioAreaShell` provides persistent category navigation for related tasks. Collection pages list, filter and sort resources in the main pane. Opening a resource replaces category navigation with its working controls in the same frame. Single-feature products (Workflows, Traces, Logs) have no category navigation and use the full frame; Logs and Traces render their lists without a card container.

  | Destination | Capabilities                                                                                                                      |
  | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
  | Chat        | Landing page: last conversation, agent switcher, pinned and recent agents, threads                                                |
  | Agents      | Metrics (with a last-24-hours summary), Intelligence when enabled, searchable agent list with pins, Agent Builder when configured |
  | Workflows   | Workflows, including schedules                                                                                                    |
  | Traces      | Traces                                                                                                                            |
  | Evaluate    | Experiments (all, including those without a dataset), Review Queue, searchable dataset list (Items and Experiments per dataset)   |
  | Logs        | Logs, full page                                                                                                                   |

  `studioAreas` describes task membership, while `useStudioNavigation` remains the permission, CMS and feature-gating boundary. `useStudioDestinations` groups only authorized features, choosing the first accessible collection as the landing page. Desktop and mobile share this behavior and the same customization preference. All task destinations are visible by default; Customize sidebar still lets users move areas into More, and former Build and Monitor choices carry over to the areas split from them. Studio opens on Chat.

  The library — Prompts, Tools, Processors, Scorers, Workspaces (files and skills) and MCP Servers — feeds every area, so it is not an area. Each is a dedicated full-width page listed under More (`libraryPaths`); the current one surfaces in the rail while open, and Customize sidebar can pin any of them. Integrations connect to everything, so they stay pinned at the bottom of the rail above Settings and Documentation. Public URLs and feature-name command search are preserved.

  Agents has no collection table: `/agents` opens the most recently used agent (else the first), and the agents list stays in the sidebar while an agent is open. `AgentShell` owns that list above its per-agent keyed providers, so switching agents keeps the list, its scroll and its search. The area sidebar never repeats its own name as a row, and its search sits in the fixed header above the list. Its views (Overview, Editor, Metrics, Traces, Evals) are links in a row that stays above the scrolling view; the Editor and Chat keep their own working sidebars. A collapsed sidebar reopens from the start of the page header, an open one collapses from its own header.

  Evaluate follows the same shape: `/datasets` opens the first dataset, and the datasets list stays in the sidebar below Experiments and Review Queue (with its count of results awaiting review). A dataset switches between its Items and the Experiments run on it. The global Experiments list remains, because experiments run on inline data or on a deleted dataset have no dataset. Agents and workflows show their own experiments in an Evals view. Scorers are parts attached to agents and datasets, so they live in the library.

  Agent pins are shared by Chat and the Agents sidebar. Only agent ids are stored, scoped to the instance, API prefix and signed-in user, and resolved against the current agent list before rendering. An agent's tools section links to the full Tools catalog when the user may read it.

- `ToolsShell` and `ProcessorsShell` use `ResourceDetailShell` for detail routes. Tools use a searchable catalog in the sidebar and Playground/Overview tabs in the main pane. Request and response reuse the drawer components and switch between columns and stacked sections based on available content width. Tool input survives switching to Overview or resizing. Processor test controls use `ExecutionWorkspace` in the sidebar, with results in the main pane.
- `McpShell` lists servers and the selected server's tools in one sidebar shared by
  connection details and tool execution.
- `AgentShell` provides the shared model, keyboard and navigation-panel scope.
  `AgentDetailShell` owns a full-height `FeatureShell` across Chat, Editor and
  Traces. `AgentNavigation` remains mounted on the left, and `AgentLayout` keeps
  breadcrumbs and overview controls above the main pane to its right.
  `AgentWorkspaceView` portals only the active view's working sections into the
  layout-owned sidebar slot, preserving thread/editor provider context. Chat
  supplies threads and memory; Editor supplies configuration and version actions.
  There is one navigation tree for the current viewport, and view changes keep
  both the sidebar and breadcrumb mounted.
- `WorkflowShell` owns a full-height sidebar headed by a workflow switcher (pinned and recent
  first); `/workflows` opens the last opened workflow (or the first). Expanding lays the detailed
  table (runs, pending input, steps, schedules) over the frame, growing from the sidebar's edge;
  picking a row, Escape or Collapse folds it back.
  `WorkflowLayout` supplies run controls and recent runs through `SidebarContent`,
  retaining the workflow execution providers while leaving the canvas unobstructed.
- `PromptBlocksShell` spans create and edit routes; its collection is a library page. Its sidebar
  lists prompt blocks and receives the form's configuration, variables and save
  actions through the shared sidebar slot. The main pane contains prompt content.
- Other CMS create and edit routes use their existing form layouts alongside the rail.
- `WorkspaceShell` provides Workspaces navigation, a compact workspace picker and a shared explorer slot. `WorkspaceBrowser` keeps one provider for file selection, search and expanded folders. `WorkspaceExplorer` composes a full-row search input, Files/Skills tabs, and relevant permission-gated actions. Installed skills open their SKILL.md in the main preview. Selecting a file closes the mobile navigation drawer.
- Logs, Traces and Metrics pages keep their filters, sorting, trace drill-down and metrics controls. Evaluate pages retain experiment comparison, dataset versions, result drawers, scoring and human review.

Add pages beneath the appropriate shell in `src/App.tsx`. Keep contextual sidebar
choices in the route tree instead of pathname checks in the shared frame. Reuse
the design system's navigation components and semantic tokens; the shells own
positioning, while the design system owns presentation.

`FeatureWorkspaceLayout` owns one persistent `FeatureShellFrame`, portal target and shared desktop width. Route handles declare the navigation label; primitive `FeatureShell` components contribute their content without mounting another frame. Switching between primitive routes updates the contents while retaining the sidebar element, divider and width. Mobile drawers never overwrite the desktop preference. Desktop dividers support both pointer and keyboard resizing. The
page panel stays mounted when navigation moves into a mobile drawer.
The shared frame clips its contents inside the reserved rim, so sidebar fills
and internal dividers cannot paint over the outer rounded border.

`ContextualSidebarLayout` positions secondary navigation with a fixed header, independently scrolling body and footer slots. Navigation rows use shared 12px corners; the square icon rail retains its own styling. Keep view-specific data and actions in the domain components that
fill these slots. Agent chat keeps this sidebar open on empty conversations;
users can still resize or hide it. Recent agent ids are scoped to the server and
signed-in user, and resolved against the current agent list before rendering.

`SidebarSearchInput` fills the complete search row, including its pointer and keyboard focus area. It uses an unstyled DS input rather than nesting a pill inside a padded wrapper. Clear restores focus and the unfiltered list. The shared shell uses the surface-rim token for dividers and each header owns a single border.

`ContextualSidebarHeader` and `ContextualSidebarSection` own sidebar header height, borders and row insets. Collection and detail navigation reuse these components instead of defining their own spacing.

Use the design system's `ScrollArea` for layout scrolling. `ContextualSidebarLayout` owns the sidebar body's viewport and keeps its header and footer outside it; simple navigation lists should not add another scroller. Sidebar search inputs sit in the layout header, outside the scrolling body, so rows and the scrollbar never pass beneath them. Constrained sections, such as the workflow list or workspace tabs, can own a `ScrollArea` when they need to scroll independently. Use `CollapsibleContent` with `fill` when its scroll area must fit remaining space. `PageLayout` owns document-page scrolling; fitted workspaces provide their own scroll areas for forms and results.

Catalogs use `PageLayout variant="catalog"` with `DataList scroll="page"`. The layout owns vertical scrolling and keeps its search/view action row sticky within that viewport, with a themed gradient edge. Lists grow with their rows and retain only horizontal scrolling when needed. Embedded and virtualized lists retain the default contained scrolling mode.

`SidebarSlotProvider`, `SidebarSlot` and `SidebarContent` compose view-owned
controls into route-owned sidebars without duplicating a sidebar or losing the
view's provider context. A stable portal destination also retains unfinished input
when the sidebar moves into the mobile drawer. Sidebar headings and lists remain available independently
of the main page's loading or error state.

Chat and agent management are separate destinations. `/chat` resumes the last visited
conversation; `/chat/:agentId` resumes that agent's conversation. History stores only
agent/thread IDs, scoped to server, API prefix and signed-in user. Saved threads are
validated directly (including beyond the first history page); deleted threads fall
back to a new conversation, and inaccessible agents are skipped. Existing
`/agents/:agentId/threads/:threadId` deep links remain supported and activate Chat.
Chat has no breadcrumbs: the agent switcher sits at the top of its sidebar, and the former
`/chat/agents` picker redirects to `/chat`.

Agent collection links open `/agents/:agentId/overview`. The full-height sidebar
keeps the active agent visible above Overview, Editor, Metrics and Traces. Agent
detail views also show recent conversations for that agent and an activity summary
for the last 24 hours, subject to permissions and storage capabilities. Chat does
not display Editor or Traces navigation. The editor keeps its test conversation,
versions, draft/publish and filesystem actions. Attached workflow cards show actual
steps without implying execution order; opening a card retains the existing graph,
run controls, schedules and history. Resource sections reuse the configuration
components, including tools, memory, model fallback ordering, skills and channels.
Overview is the one page for an agent: purpose and 24-hour activity, then every resource
section (model, tools, workflows, prompt, memory, channels…) behind a stable anchor. Attached tools
show descriptions and expandable schemas, with their existing agent-scoped
inspection and testing drawers. Legacy `/configuration` and `/resources/:resource` URLs
redirect to the matching Overview section and preserve query parameters.

Chat Config is a panel docked inside the conversation, closed by default. While open it
stays in view and, when the canvas is at least 56rem wide, pushes the chat aside instead of
covering it. Its Open overview action opens the selected agent's Overview; the close
control, Escape key and `]` shortcut remain available.

Navigation is instant: there is no global view transition between routes.

Agent metrics reuse the global metrics dashboard and storage gate. The route pins
`rootEntityType=agent` and `entityName` to the loaded agent; URL parameters and saved
global filters cannot change this scope. Date ranges and additional filters remain
available, and trace drilldowns stay in the selected agent. The metrics API currently
scopes by entity name, so agents with identical names share that aggregation.
