# Page frame

<overview>
The app shell, the `PageLayout` width and header, where actions go, how the body is built, and the page-level product rules. Read `core.md` first.
</overview>

<instructions>

## App shell and page frame

Every app and every page uses the same two layers. Never build either by hand.

```tsx
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';

<Sidebar.Provider>
  <AppShell sidebar={<AppSidebar />} mobileHeader={<MobileHeader />}>
    <MainCard>
      <Outlet />
    </MainCard>
  </AppShell>
</Sidebar.Provider>

// a route
<PageLayout
  variant="narrow"
  breadcrumbs={<PageBreadcrumbs crumbs={[navCrumb('/mcps'), mcpServerCrumb]} />}
  header={
    <PageHeader>
      <PageHeader.Title>Linear issue tracker</PageHeader.Title>
      <PageHeader.Description>Reads and writes Linear issues for agents in this project.</PageHeader.Description>
    </PageHeader>
  }
>
  {body}
</PageLayout>
```

- **The app shell** is `AppShell` with a `Sidebar` sidebar and `MainCard` around the routes, mounted once at the router level. `AppShell` owns the spacing around the card. Studio (#24697), Factory (#24806), and Mastra Code web (#24718) all use this.
- **The sidebar** is `Sidebar` and its parts: `Sidebar.Header` or `.CommandHeader`, `.Brand`, `.Nav`, `.Sections` (preferred, data-driven) or `.NavSection` > `.NavList` > `.NavLink`, `.NavStack` for drill-in views, `.Footer`, and `.Trigger` / `.MobileTrigger`. Never use `MainSidebar` in new code, and never import `MainSidebar.*` parts next to `Sidebar`, because every part has a `Sidebar.*` name. Agent Builder's `MainSidebar` and Factory's `MainSidebar.Nav*` calls are legacy. Inside `AppShell`, render `<Sidebar aria-label="Sidebar">` with no `className`: never add a `border-r` or background. The gap `AppShell` leaves around the rounded `MainCard` is the separator, and a full-height border runs past the card's corner to the top of the window. The `Sidebar` Storybook story adds `border-r` because it renders the sidebar without `AppShell`; do not copy it.
- **The page title is `PageHeader`, passed to `PageLayout`'s `header` slot.** It is the page's only `h1`. Never render a title, `<h1>`, or `MainHeader` / `EntityHeader` in the body. Which pages get one is decided in Page layout below: `narrow` pages and dashboards do; indexes and one-entity workspaces rely on their breadcrumbs.
- **Each rendered page has one `PageLayout` owner.** A route can own it directly, or a shared layout can own it while child routes render only bodies. Sibling views sharing a header keep that owner mounted across navigation. Do not add another frame to a child body, write a local header or width wrapper, or rebuild the frame for loading, error, or empty branches.

## Page layout

Pick width first, then the header. They are separate choices: `header` works on every variant.

```text
Width
Is it a workspace for one entity: panels, editor, graph, board, or chat that scroll on their own?
|-- Yes -> fit
|-- Is it an index of many entities (Agents, Tools, Traces, Logs, Datasets)?
|   \-- Yes -> container (the default)
|-- Is it a dashboard whose content sits side by side (panels, charts, metric cards in columns)?
|   \-- Yes -> container
\-- Otherwise it is one column read top to bottom (stacked overview blocks, feed, settings, simple detail, wizard)
    -> narrow

Header
Is this page a destination with a title of its own (a narrow page, a dashboard, a named entity overview)?
|-- Yes -> header={<PageHeader>…</PageHeader>}
\-- No (an index or a one-entity workspace) -> breadcrumbs only; indexes add an actionRow, workspaces add routed tabs
```

Some pages look like destinations but take no `PageHeader`:

- **A view that opens on a filter row is an index**, even when its body is charts or metric cards (Platform's Metrics, Requests, Traces, Logs). The `actionRow` renders above the body, so a header would land under the filters. Its breadcrumbs name it.
- **A chooser that stands in for the page the user asked for is not a destination.** Platform's project picker ("Continue to Metrics") keeps its centered prompt; the user is on the way somewhere else.
- **A route that already renders its own entity header keeps it.** Do not add a second one, and do not move it into `header` as part of unrelated work.

`container` gives lists and dashboards the full width, `fit` hands the body to panels that manage their own scroll, and `narrow` caps reading width. Pick by the content's shape. "Overview" is not a layout: Factory's overview is stacked blocks (`narrow`), and Platform's project overview is a side-by-side dashboard (wide, with a header).

### Narrow pages: the frame owns width and title

A `narrow` page is one `max-w-5xl` column, so page edges and titles line up across pages, and one `h1` from `PageHeader.Title`.

- Page content MUST NOT set `mx-auto`, `max-w-*`, or its own width wrapper. Delete any it has.
- Page content MUST NOT render a title block: no `<h1>`, no `Txt variant="heading"` title, no `sr-only` h1, and no custom shell with a title prop. A settings section name, a connection name (with `PageHeader.Icon`), and a wizard name are page titles. A wizard's step title labels the step's control instead, so the page keeps one `h1`.
- `PageHeader` (`@mastra/playground-ui/components/PageHeader`) is the only page header. Every `narrow` page and every dashboard has one, passed through `header`. Indexes and workspaces have none, and their breadcrumbs name them. The Agent Builder index pages currently add one to `container`. Never use `MainHeader`, `EntityHeader`, or a hand-built heading row on a new page. The 7 Studio pages still using them (datasets, workflow entity header, experiment panels) are legacy; do not copy them.
- Use the compound API only. The props form (`<PageHeader title="…" description="…" />`) is legacy; nothing uses it, and new code must not start.
- `PageHeader` parts: `.Title`, `.Description` (optional, one sentence saying what the page is for), `.Meta beside` for a version or the entity's state as a `Badge`, `.Icon`, `.Eyebrow` (a back link above the title, create and edit flows only), and `.Action` (top-aligned, never re-aligned with classes). Pass loading through `PageHeader.Title isLoading`, not a skeleton of your own.
- The way back is the `breadcrumbs` trail (`X › Current`). A create or edit flow also gets a back link in `PageHeader.Eyebrow` (`← Back to alerts`), above the title. Never put a back link in the page body or in `.Action`.
- **The breadcrumb bar holds navigation and reference links, never actions.** Its left side is the breadcrumbs. Its right side (`headerActions`) may hold `Button variant="link" size="sm"` links that take the user somewhere to read, such as Docs or API endpoints, plus the shell's collapsed-sidebar trigger and search. Anything that creates, changes, runs, or deletes is an action and goes on the page's own row, because the bar is shared chrome, not part of the page:
  - `container` index: `<ActionRow.End>`, after view options, with the primary action last.
  - `fit` workspace: the right end of the routed tab row.
  - `narrow` page or dashboard: `PageHeader.Action`.
    Studio's `HeaderCreateAction` ("New X" in `headerActions`) is legacy; do not copy it.
- **Breadcrumbs:** pass one breadcrumb element to `PageLayout`'s `breadcrumbs` prop. Never render crumbs anywhere else on the page. In Studio, never assemble `Breadcrumb` and `Crumb` by hand; use the existing helper so icons and labels match the sidebar:
  ```tsx
  import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
  import { agentCrumb, navCrumb } from '@/domains/navigation/crumbs';

  <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={[navCrumb('/agents'), agentCrumb]} />} />;
  ```
  - **One crumb per level from the origin.** Build the trail from the route, not from what feels useful: start at the sidebar section the page lives under, then add one crumb for each level below it down to the current page. A trail with only the section crumb is correct only on the section's own index page. Every page below it has at least two crumbs, and the missing second crumb is the most common mistake.

    ```text
    /agents                      [navCrumb('/agents')]
    /agents/:id                  [navCrumb('/agents'), agentCrumb]
    /scorers/create              [navCrumb('/scorers'), { id: 'create-scorer', label: 'Create scorer' }]
    /datasets/:id/versions       [navCrumb('/datasets'), datasetCrumb, { id: 'dataset-versions', label: 'Versions' }]
    /experiments/review-queue    [navCrumb('/experiments'), navCrumb('/experiments/review-queue')]
    ```

    Before finishing a page, count its route segments below the section and check the trail has that many crumbs after the section crumb. Tabs of one entity (`/agents/:id/traces`) are the exception: the tab bar names the view, so the trail stops at the entity.

  - The first crumb is a section from the nav registry: `navCrumb('/agents')`. It takes its label and icon from the sidebar item and throws on an unknown URL.
  - An entity crumb is a predefined `CrumbDef` (`agentCrumb`, `workflowCrumb`, `toolCrumb`, `datasetCrumb`, …) that renders the entity's name and an icon-only switcher. Add a new one to `crumbs.ts` next to the others; do not inline it in a page.
  - Deeper crumbs are plain defs: `{ id: 'versions', label: 'Versions' }`. Use `decodeRouteParam` or `truncateItemIdCrumb` for route IDs.
  - The last crumb is the current page and never links; `PageBreadcrumbs` handles that.
  - Outside Studio (Factory, Platform), compose `Breadcrumb` and `Crumb` the way `PageBreadcrumbs` does: `<Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">`, parent crumbs as `<Crumb as={Link} to=…>`, and the last as `<Crumb as="span" isCurrent>`.
- Sub-views of one entity are routed tabs under the breadcrumbs, `TabList variant="pill-ghost"`, as on the agent and workflow pages. Do not use header buttons that jump to a global page.
- On a `container` index page, search, filters, and toggles go in `actionRow` as `<ActionRow><ActionRow.Start/><ActionRow.End/></ActionRow>`: search and filters in `Start`, view options and the primary action in `End`.

### Filters

A page filtered by anything more than free text has one `FilterBar` in `ActionRow.Start`, and nothing else filters it: no row of `Select`s, no second search box, no range toggle beside it. One bar holds every scope the page has, so the reader sees in one place why the numbers are what they are ([#29626](https://github.com/mastra-ai/mastra/pull/29626)). Studio's Metrics, Traces, Datasets, and Experiments pages are the reference.

```tsx
<FilterBar
  fields={[FILTER_BAR_TIME_RANGE_FIELD, ...fields]}
  operators={DEFAULT_FILTER_OPERATORS}
  value={[FILTER_BAR_TIME_RANGE_ITEM, ...filters]}
  onValueChange={items => setFilters(items.filter(item => !isTimeRangeItem(item)))}
  createItemId={fieldId => fieldId}
  aria-label="Request filters"
  className="min-w-64 flex-1"
>
  <FilterBar.Chips renderChip={item => (isTimeRangeItem(item) ? <FilterBar.TimeRange … /> : <FilterBar.Chip item={item} />)} />
  <FilterBar.Input placeholder="Filter requests" />
</FilterBar>
```

- **The time range is the first chip.** A time-scoped page adds `FILTER_BAR_TIME_RANGE_FIELD` to `fields` and `FILTER_BAR_TIME_RANGE_ITEM` first in `value`, and renders `FilterBar.TimeRange` for it. It scopes the page rather than filtering it, so it cannot be removed. A page whose only control is a time range uses `DateTimeRangePicker` alone, the same control outside a bar.
- **Offer only the presets the data supports** with `presets`, and set `defaultPreset` to the page's default so the reset × returns there. Pass `minDate` when data expires, so nobody picks a range with nothing in it.
- **Field labels are gray, never a hue.** Every field passes `color: 'var(--muted-foreground)'`, the time range included. A hue per field made chips compete with the data and meant nothing a reader could learn. Never use `hueAccentColor` on a filter field. The `Composite/FilterBar` stories and the Datasets, Experiments, review queue, and MCP tasks bars still use hues and predate this rule; do not copy them ([#26269](https://github.com/mastra-ai/mastra/pull/26269)).
- **One field per dimension**, each with an icon. A closed set of values (status, environment) is `strict` with `suggestions`; values that come from the server use a suggestions resolver, which loads only when the value step opens. List one `search: true` field first so typed text always lands somewhere instead of "No matching field".
- **Operators** start from `DEFAULT_FILTER_OPERATORS`, narrowed per field with `operators`. A status takes `is` and `is not`; a name takes `contains` and `is`.
- **State lives in the URL.** Rebuild `value` from the URL on every render and pass `createItemId={fieldId => fieldId}`, so the chip being built and the committed chip are the same element. The time range keeps its own URL params and never round-trips through the filter items.
- **Copy**: `aria-label="{Things} filters"` and `placeholder="Filter {things}"`, sentence case, no ellipsis.
- `SettingsLayout` is replaced by `narrow` + `PageHeader`. Do not add it to new pages. Studio's `/settings` still uses it and will migrate.

### Narrow pages own the gap below their title

On a `narrow` reading page, `PageLayout` adds no space between the header and the body (#24817). The body's first element sets it, and ends with bottom padding so the last block clears the frame: `<div className="mt-6 flex flex-col gap-6 pb-16">`. Use `mt-6`, the Factory value. Studio's MCP page uses `pt-4`. Report the mismatch; do not add a third value.

Do not copy this inset to other variants. A `container` already owns its body gutter; Metrics and Requests do not add bottom padding to their dashboard grid. A `fit` body lets its panels own spacing and scrolling.

### Inside the body

```text
A group of settings?                  -> settings group (below)
Rows of data to read and compare?     -> Table variant="inset" (+ ListSearch above it; FilterBar when filters exist)
A list that needs list navigation?    -> DataList: gliding row hover, keyboard row movement, sticky or reorderable columns, virtualization, infinite loading
A labelled value to read at a glance (balance, plan, total, count)? -> MetricsKpiCard, side by side in flex flex-wrap gap-4
One bounded object with its own actions or tabs (Connect card)? -> Card > CardHeader (CardTitle) + CardContent
A labelled region of a dashboard or feed (Pipeline, Today)? -> <section> with an in-page section label, no surface
Nothing to show, or a failure?        -> EmptyState variant="fill"
```

- **Settings group**: `SettingsGroup` > `SettingsHeader` (`SettingsTitle`, optional `accessory` and `action`) > `SettingsContainer` > `SettingsRow label description` with the control as its child. Factory wraps the header in `SettingsSubsection` to add a scope badge; reuse that wrapper there, without its `description`.
- **`SettingsContainer variant="inset"` is for one case:** a short stack of two to four rows that is the main content of a dialog, such as Add credits. Everywhere else, including settings pages, forms, drawers, tabs, and any view that shares the screen with a `DataList` or another card, use the default variant. The recessed rows read as nested surfaces, so using them outside a dialog makes the screen busier than the rest of the product.
- **Words follow `copy.md`.** It decides whether a description, tooltip, placeholder, or button label is allowed and what it says. This file only covers the components that render them:
  - Page context is `PageHeader.Description`. Rows, fields, and sections have no description lines.
  - An explanation is an info icon with a tooltip, placed right after the label it explains. Use `InfoTooltip` from `@mastra/playground-ui/components/Tooltip` with an `aria-label` ("About run failures"); its content stays under 240px. On a field, pass the explanation to `FieldLabel info` instead, which renders the same icon and keeps the tooltip mounted so `aria-describedby` reaches it. Never hand-roll the trigger and content.
  - `SettingsRow` has no info slot. Pass an `InfoTooltip` inside `label`; on a required row the asterisk then lands after the icon. That is a known gap.
- **Tables and lists**: rows of data (deploys, usage, credits, invoices, keys, plans, settings records) are `Table variant="inset"`. Numbers align to the end with `align="end"` on the head and every cell; one column takes the spare width with `className="w-full"` on its head; a row that navigates gets one `Table.RowLink` and a row that opens a drawer gets one `Table.RowButton`, never `onClick` on `Table.Row`. Use `DataList` only when the view needs its list navigation: gliding row hover, keyboard row movement, sticky or reorderable columns, virtualization, or infinite loading (Studio's traces and logs). Record count is not the deciding factor. Never paint `hover:bg-*` on a row or hand-roll a grid list. Filters go through `FilterBar`, not a row of selects.
- **Tab panels**: a panel that holds a `SettingsContainer`, `Table`, `DataList`, or `Card` uses the default `TabContent`, not `flush`. A `flush` panel scrolls with `overflow-y-auto`, which crops the raised surface's shadow along its bottom edge; keep `flush` for scroll regions and code blocks. A list inside a tab is a `DataList` on its default raised surface, never `variant="light"`, and pages with `DataList.Pagination` at 10 rows once it can outgrow the screen.
- **Cards**: a `Card` takes the same radius as an inset `Table` and `DataList`. Tabs inside a card header are `TabList variant="pill-ghost" size="sm"`, and each `TabContent` is `flush` unless it holds a raised surface (see Tab panels). Do not stack several cards for what is one object with modes; use tabs inside one card. Do not wrap a `DataList` or a field in a `Card`, because each already has its own rim.
- **Sections without a surface**: space them with `gap-*` on the parent (`gap-6` default, larger for a dashboard). A section needs a label, not a box.
- **A summary value is a `MetricsKpiCard`, not a `Card`.** A credit balance, the current plan, or a period total is a label and a value, and `MetricsKpiCard` puts them in a fixed order with the value in its own role and padding. A `Card` with a `CardTitle` and body text leaves a title-sized gap above a body-sized value, so the number the user came for reads smaller than its own label. `Card` is for one object with its own actions or tabs ([#29626](https://github.com/mastra-ai/mastra/pull/29626)).
- **Headings at one level match.** Every section heading at the same depth of a page uses the same component and role. A `column` label beside a `SettingsTitle` makes two peers look like parent and child. When a page mixes settings groups with other sections, give every section a `SettingsHeader` ([#29626](https://github.com/mastra-ai/mastra/pull/29626)).
- **A section label that only restates what its children already say is cut.** "Plan and credits" above cards titled Plan and Credits adds a heading level and says nothing new; `copy.md` section 2 applies to headings too.
- **States never move the frame.** Loading, empty, error, and ready share the same breadcrumbs, `PageHeader`, header actions, `actionRow`, and routed tabs. Only the body changes. When one of these disappears in a state, everything below it jumps. On error, keep the `PageHeader`, with the route's ID as the title when the name failed to load; never drop to an `sr-only` `h1`.
- **Static structure renders while data loads.** Section titles, row and field labels, card headers, tab lists, KPI labels, and column headers are known before the request returns, so they render immediately. Only data-driven parts load: a `Skeleton` sized to the control it replaces, `MetricsKpiCard.Loading` for a value, the table's header row with `Skeleton` rows for the expected count (`DataListSkeleton` with the same `columns` for a `DataList`), and a disabled picker that reads "Loading models". Never replace a whole section with one generic block; the ready content will not match its height.
- **An empty state does not repeat the header's primary action.** Its description points to that action instead.
- Empty and error states are `EmptyState variant="fill"` (`tone="error"` for failures), and loading is `Spinner fill`. The `narrow` body fills the page height, so they center below the header. Never pass an icon size or color; `EmptyState` fixes the icon at 32px.
- Spacing around the app card belongs to `AppShell`, and the card surface is `MainCard`.

## Page character

- A page MUST have one clear primary action.
- Agents MUST preserve the surrounding product's information density. They MUST NOT add decorative cards, oversized headings, gradients, or empty space that changes the product's visual character without a supplied reference.
- Agents MUST NOT introduce a new visual language inside one page, and MUST NOT copy styling from another Mastra product surface when the target surface has its own established pattern.

## Factory settings

- Group Factory settings by topic: Account, Agent, and Factory. Models and Memory each have one destination, with personal and Factory scope inside the page, not duplicate personal and Factory pages.
- A missing-credential link lands on the defaults the session uses: Models `#personal-defaults` or `#factory-defaults`. Preserve that scope in the visible message and destination; a link to unrelated keys is not recovery.

## Content and states

- Page titles MUST state the user's task in product language. All other copy, including descriptions, tooltips, placeholders, and button labels, follows `copy.md`.
- Forms MUST use persistent labels and inline validation.
- Every affected loading, empty, error, success, disabled, and permission state MUST be designed and tested when the page can enter that state.
- Destructive actions MUST be separated from routine actions and use the product's existing confirmation pattern.
- Existing keyboard behavior, focus treatment, touch targets, and screen-reader labels MUST be preserved or improved through shared components.
- Responsive behavior MUST follow an existing nearby page. Controls MUST remain reachable and readable without horizontal scrolling at the supported narrow width.

</instructions>

<quality-checklist>
- [ ] The variant matches the content's shape (index or side-by-side dashboard: `container`, one-entity workspace: `fit`, one column: `narrow`), and the header decision was made separately
- [ ] `narrow` pages have a compound `PageHeader` in `header`; no `MainHeader`, `EntityHeader`, or hand-built title; content sets no width and renders no `h1`
- [ ] A `narrow` reading body sets `mt-6` below its title and `pb-16` at the end; container dashboards do not duplicate the frame's padding
- [ ] Rows of data are an inset `Table` (`DataList` only for list navigation), settings are `SettingsGroup` > `SettingsContainer` > `SettingsRow`, and cards are not nested around rims
- [ ] `SettingsContainer variant="inset"` appears only on a short stack of rows that is a dialog's main content
- [ ] Tab panels that hold a `SettingsContainer`, `Table`, `DataList`, or `Card` are not `flush`, and a table in a tab is an inset `Table` with `Table.Pagination` at 10 rows
- [ ] The app uses `AppShell` + `Sidebar` + `MainCard`; no `MainSidebar` in new code
- [ ] One route or shared layout owns the page's `PageLayout`; child bodies and state branches do not add another, and shared headers stay mounted across sibling views
- [ ] A page with a title passes a compound `PageHeader` to `header`; nothing else renders an `h1`
- [ ] The breadcrumb trail has the section crumb plus one crumb per route level below it
- [ ] The breadcrumb bar holds only breadcrumbs and reference links (Docs, API endpoints); actions live in `ActionRow.End`, the tab row, or `PageHeader.Action`
- [ ] Switching between loading, empty, error, and ready does not move the header, toolbar, tabs, or section titles
- [ ] Empty, error, and loading states use `EmptyState variant="fill"` / `Spinner fill`
- [ ] Loading, empty, error, permission, and destructive states follow existing patterns
</quality-checklist>
