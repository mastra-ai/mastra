# Color and status

<overview>
Runtime status, record badges, the color tree from ramps to roles, and the opacity rule. Read `core.md` first.
</overview>

<instructions>

## Status and color

- **Runtime state is `Status` from `StatusIndicators`.** Anything that says what a running thing is doing (a server, deploy, sandbox, agent, run, job, alert delivery, or incident: Running, Deploying, Healthy, Failed, Processing, Sent, Open) is `<Status presentation={{ label, tone, description }} />`. `tone` is `success`, `progress`, `error`, or `neutral`, and `glyph` is `filled` (default) or `ring`; the dot is always a circle and carries the hue, which keeps status off the text (see the icon rule below), and `description` is the tooltip that explains the state. Deploy and server status MUST use the six canonical `deployStates` (Ready, Building, Idle, Queued, Stopped, Error) and never surface `unknown`. Define presentations once per domain as a `Record<Status, StatusPresentation>` map. The label always inherits its container's size and color and has no text-style override, so `<Status presentation={p} />` matches its siblings in a `DataList` cell, table row, or sentence. When the container sets no text style (a card), put the role on the container, never on the status.
- **Settings and records are a `Badge` without `indicator`.** A value that describes configuration or an account record rather than something running (Enabled, Disabled, Differs from build, a license that is Active or Revoked, a Pending join request, an issue's review state) is a `Badge` with `variant` for hue and `size="sm"`. The dot is reserved for runtime state, so a `Badge` never takes `indicator`.
- **An HTTP status code is a record, so it's a `Badge`, never `Status`.** A proxied request, a delivery attempt, or a log line is finished and its code won't change, while the dot promises a state that might. Color by class with `emphasis="subtle"` and `size="sm"`: 2xx `success`, 3xx `info`, 4xx `warning`, 5xx `destructive`. A request that got no response is `destructive` and shows its error code. These match the request chart hues (green, blue, amber, red), so one code reads the same in a list, a drawer, and a chart. Keep it muted even when it stands alone: a column of filled pills is mostly green and buries the rare 4xx or 5xx the reader is scanning for, and a detail view must match the row it opened from.
- **The page's own entity state beside its title is a `Badge`** in `PageHeader.Meta beside`, `emphasis="subtle"` and `size="sm"`, with the hue carrying the state (connection detail: `Active` green, `Reauthorization required` `warning`). It labels the whole page, so it reads as a chip beside the name rather than a row value. One badge per header.
- Otherwise `Badge` is for things that are not states: counts, versions (`v2.1.0`), type tags (`App`), plan types (Starter `neutral`, Teams `green`, Enterprise `blue`, matching the pricing page), scope (`Project`), and priority. Use `variant` for hue and `emphasis="subtle"` in dense rows. Priority and severity are a badge, not a colored row, so every item keeps one shape.
- `Notice` (`info`, `warning`, `destructive`, `success`, `note`) is the only boxed message. Never style a `div` as a callout.
- A disclosure (chevron, collapsible) appears only when the hidden body says more than the visible line. Text that fits its line wraps instead.
- **No dot between facts.** Never join facts with `·` (or `•`, `|`, `-`), including a time range beside its granularity (`Last 7 days · hourly`) and a status beside its timestamp. A dotted run reads as one string: the eye cannot tell which fact is which, one long value truncates the rest, and the row cannot wrap between facts. Give each fact its own element instead: its own `DataList` column, its own item in a `flex gap-*` row (icon plus value, as in a commit hash or elapsed time), or its own `SettingsRow`. In a sentence, use words and commas.
- An element never owns its width in a flow context such as a chat column or card list. The container sets it.

## Color

Colors come in three layers. Ramps (`red` … `pink`, `50`–`950`, plus the dark-mode `-soft-900`/`-soft-950` steps) are the only place a literal color exists, in `theme/colors.css`. Semantic roles point at ramp steps and swap per theme. Components and pages use roles. A literal `#hex`, `rgb()`, `hsl()`, or `oklch()` outside the theme is never correct: it skips theme switching and the contrast checks the roles already passed.

Every hue's ramp sits on one lightness grid: each 400 is L 0.70, and amber runs lighter on purpose. Never nudge a step off the grid to fix contrast. A lighter step caps its chroma and the color drifts, which is how `red-400` at L 0.76 once turned dark-mode destructive text salmon. Fix contrast at the role by pointing it at another step. A status `Badge` takes its text from its hue's badge foreground (`badge-red-foreground`, `badge-green-foreground`, `badge-blue-foreground`), except warning, which keeps `warning-foreground` so it still reads as yellow.

Walk this tree for every colored thing:

```
What does the color mean?
├── A state (success, destructive, warning, info)
│   ├── A box or tint → the component that owns it (Notice, Badge variant, Status); it uses {status}-subtle + {status}-edge
│   ├── Text on that tint → {status}-subtle-foreground, only inside those components (near-white or near-black on a plain page)
│   ├── Text or an icon on the plain page
│   │   ├── destructive, warning → {status}-foreground (the indicators are too light to read as text in light mode)
│   │   └── success, info → {status}-indicator
│   └── A dot, a bar, a chart mark, an invalid-field border → {status}-indicator
├── A kind, not a state
│   ├── A chip → Badge variant={hue}, emphasis strong (default) or subtle
│   ├── A Mastra product → ProductAvatar / ProductBadge
│   ├── A chart series, area, or line → --chart-{hue}; ordered values → --chart-sequential-1…5 (1 is the strongest)
│   ├── A trace span → --span-{type}
│   └── Anything else (a file icon, a label dot, a colored word) → a ramp utility with a dark: pair,
│       light step 700 for text and 600 for marks: text-purple-700 dark:text-purple-400
└── No meaning (surface, ink, edge) → neutral roles: foreground, muted-foreground, placeholder, border, fill-*
```

- `--chart-*` tokens are for data visualization only. Borrowing them for a label ties the label to whatever the chart palette becomes next.
- Destructive and warning text on the plain page uses `{status}-foreground` because those indicators are too light to read as text in light mode ([#25587](https://github.com/mastra-ai/mastra/pull/25587)).
- There is no `error` token. It was the same red as `destructive`; use `destructive-indicator`.
- A ramp utility without a `dark:` pair is correct in one theme only. A single step tuned for the dark page (`text-green-400`) lands near 2:1 on the light page.

## Opacity

A resting color never depends on what sits behind it: a translucent badge, notice, or status tint changes color on every surface it lands on and its contrast can no longer be checked. Resting colors are solid ramp steps in both themes, whatever layer they sit on.

Opacity is allowed only through design-system tokens, for layers whose job is to show what is underneath: state layers (`fill`, `fill-subtle`, `fill-hover`, `fill-active`, `fill-strong`), scrims (`scrim`), badge fills (`badge-{hue}-strong` and `-subtle`, so a badge tints with the card or row under it when that changes on hover), neutral hairlines (`border`, `surface-rim`, `gray-alpha-*`), and fades, glows, and chart overlaps inside a `ds/` component. Product code (Studio, Factory, `ee/` features) MUST NOT add opacity modifiers to chromatic colors (`bg-green-500/20`), `color-mix()`, or SVG `fillOpacity` on its own colors. the package's theme tests keep the status, product, chart, and span roles opaque; nothing checks product code, so `node scripts/check-color-usage.mjs --report` is the review aid ([#25587](https://github.com/mastra-ai/mastra/pull/25587)).

</instructions>

<quality-checklist>
- [ ] Runtime state (servers, deploys, agents, runs, deliveries) uses `Status`; settings and records (config, licenses, requests, review states) use a `Badge` without `indicator`; other badges hold counts, versions, tags, plan types, scope, or priority
- [ ] HTTP status codes are a muted `Badge` colored by class (2xx `success`, 3xx `info`, 4xx `warning`, 5xx `destructive`), never a `Status` dot
- [ ] Boxed messages are `Notice`; status marks on the plain page use `{status}-indicator`, destructive and warning text uses `{status}-foreground`, and `{status}-subtle-foreground` appears only inside the component that owns the tint
- [ ] Every color walked the Color tree: states use status roles, kinds use Badge, product, chart, or span roles, and any other ramp utility has a `dark:` pair
- [ ] No opacity modifier, `color-mix()`, or `fillOpacity` on a chromatic color outside a `ds/` effect; `chart-*` appears only in data visualization
- [ ] No dot between facts (`·`), and never `•` or a pipe; each fact is its own column, row item, meta line, or setting row
</quality-checklist>
