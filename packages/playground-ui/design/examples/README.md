# Page examples

<overview>
Rules say what is allowed; an example shows how the parts fit. These pages are the fit. Each file in `pages/` is a whole page that is written against this package's current source, takes its data and actions as props, and uses invented data. The rules in `../rules/` stay the authority on every decision; when a page here and a rule disagree, the rule wins and this folder is the one to fix.

The shapes come from pages that shipped in October 2026, so the compositions may still change.
</overview>

<instructions>

## Pick the page

| You are building                                                                       | Start from                     | Frame                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| A settings-like overview read top to bottom: billing, plan, account, an entity summary | `pages/billing-overview.tsx`   | `narrow`, `PageHeader` with actions                       |
| A view that opens on filters, with KPIs and a breakdown: usage, metrics, activity      | `pages/usage-dashboard.tsx`    | `container`, breadcrumbs and `actionRow`, no `PageHeader` |
| A page that is mostly charts: metrics, observability, requests                         | `pages/requests-dashboard.tsx` | `container`, breadcrumbs and `actionRow`, no `PageHeader` |
| A form that creates or edits one thing: new project, new agent, edit settings          | `pages/create-project.tsx`     | `narrow`, `PageHeader.Eyebrow` back link, two-zone form   |

When none fits, walk the width and header trees in `../rules/page-frame.md` and start from the closest file.

## Use it

1. Read the whole file before writing. Copy its frame, its section order, and its spacing classes (`mt-6 flex flex-col gap-10 pb-16`, `max-w-160`).
2. Replace the props with the product's real data hooks and actions. Keep pages thin: data and mutations come from domain hooks, per the repository's own rules.
3. Before using any import, confirm it exists in the installed `@mastra/playground-ui` (`node_modules/@mastra/playground-ui/dist`). An app that pins an older version or a snapshot may not have an API used here; use the released alternative and say which upgrade replaces it.
4. Build every state the page can reach with the state rules in `../rules/page-frame.md`. The examples show ready, read-only, validation, pending, and failure; loading and empty are yours to add, and they never move the frame.
5. Write every visible string with `../rules/copy.md`. The example copy is illustrative, not approved product copy.

## What each page demonstrates

- **billing-overview**: one primary action in `PageHeader.Action` that switches between upgrade and Add credits; a read-only `Notice` instead of disabled controls; plan and credits as `MetricsKpiCard`s side by side, with no section label above them because the cards name themselves; usage as a `SettingsGroup` whose header holds a `variant="link"` button with a right chevron; values formatted with `formatFullNumber` and `formatCost`.
- **usage-dashboard**: the time range as a lone `DateTimeRangePicker` in `actionRow`, because the page has no other filters, with the primary action last in `ActionRow.End`; `MetricsKpiCard`s in `flex flex-wrap gap-4` because the card has a minimum width; `CompactNumber` for KPI values; an inset `Table` with numbers aligned to the end and one `Table.RowButton` per row. Keep the range and filters in the URL in the real page.
- **requests-dashboard**: one `FilterBar` in `actionRow`, with the time range as its first chip and route, status, and environment fields; four `KpiCard`s in a `MetricsCardGroup`; a two-column `MetricsGrid` of compact `ChartCard`s, stacked bars for counts and lines for latency, with the legend in the toolbar and the total in the header; a full-width `ShareBar` of routes; change badges only when both periods have data; a dash for a reading that was never taken; loading, empty, and error states that keep every card's size. Rules in `../rules/charts.md`.
- **create-project**: free text as a stacked `Field` with `FieldLabel` and `FieldError`; choices as `SettingsRow`s with `Combobox` option descriptions; validation on submit that clears on change; `Spinner` in the submit button with the label `Creating`; a failure `Notice` whose title and message the caller maps from the error.

</instructions>

<constraints>

- MUST NOT copy the invented numbers, plan names, or model names into product code.
- MUST NOT restyle a Playground component to match an example; every class on a component here is placement only.
- MUST NOT render a visually hidden `h1`, a local width wrapper, or `mx-auto max-w-*` on a page body, even where a shipped page does.
- Each page's sample data lives beside it in `<page>.data.ts`, only to render the page in isolation. MUST NOT import it into product code.

</constraints>

<quality-checklist>

- [ ] The chosen example is named, and the new page uses its frame and section order
- [ ] Every import exists in the installed package version
- [ ] Data and actions come from the product's hooks, not the example props
- [ ] Loading, empty, error, and permission states are built and keep the frame
- [ ] Copy passes `../rules/copy.md`

</quality-checklist>
