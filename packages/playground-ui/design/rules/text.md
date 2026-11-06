# Text roles

<overview>
Pick text by role, never by size, and when to use mono. Read `core.md` first; what the words say is `copy.md`.
</overview>

<instructions>

Pick text by role, never by size. The role carries size, line-height, weight, and tracking together. A hand-picked size breaks the pairing and stops following when the scale is retuned.

```text
Onboarding hero?                                      -> display
Heading of a page with no PageHeader (sign-in, start)? -> title, on the h1
KPI value?                                            -> MetricsKpiCard owns it (title, tabular-nums)
Page title?                                           -> PageHeader.Title owns it (heading, ink, h1)
Dialog title?                                         -> DialogTitle owns it (heading, ink)
Page description or eyebrow?                          -> PageHeader.Description / .Eyebrow own it (caption, muted)
Page header meta line?                                -> PageHeader.Meta owns it (meta, muted)
Settings group or card title?                         -> SettingsTitle / CardTitle own it (subheading, ink)
In-page section label (Pipeline, Today, Mentions)?    -> column on an h2/h3, ink or inherited; never beside a
                                                         SettingsTitle at the same level (see page-frame.md)
Prose or a description paragraph?                     -> body (muted when it explains)
Table cell, dense list, textarea text?                -> body-sm
Floating menu row or its search field?                -> menu; the shared menu recipe owns it
Field label, control label, button, nav item?         -> label
Text typed or picked in an Input, Select, Combobox?   -> label; the control sets it
Column header?                                        -> Table.Head / DataList.TopCell own it (column, muted)
Help text under a field?                              -> FieldDescription owns it (caption, muted)
Validation message?                                   -> FieldError owns it (body-sm, destructive)
Other secondary line, option or row description?      -> caption, muted
Badge, count pill, keycap?                            -> meta
```

- When a DS part owns a text slot (`PageHeader`, `DialogTitle`, `SettingsTitle`, `SettingsRow`, `CardTitle`, `FieldLabel`, `FieldDescription`, `FieldError`, `EmptyState` slots), pass plain text into it. Never wrap it in `Txt` or add a size, because the part already applies the role.
- `meta` (10px) is for badges, count pills, keycaps, and the `PageHeader.Meta` line. An option or row description is `caption`, even when it looks too big next to a label (#24677). Components size these themselves: `Badge` and `Kbd` step up to `column` (large badge) and `caption` (default keycap), so never set a role on them.
- An in-page section label is quieter than a card title on purpose: `column` is 12px against the title's 14px. Most recent section labels are ink or inherit it; use `muted` only when the label must step back from ink content beside it. Do not add `font-semibold`: the role is already medium.

- Render text with `<Txt as="…" variant="…" tone="…">`. The same role as a utility (`text-label`, `text-caption`) is allowed inside a component's own markup. Never add `leading-*`, `font-*` weight, or `tracking-*` next to a role, since the role already sets them.
- Ink comes from `tone`: `ink` (foreground), `muted` (secondary), `faint` (placeholder level); as utilities, `text-foreground`, `text-muted-foreground`, `text-placeholder`. There are three inks, not a ramp (#24645). Omit `tone` to inherit. `text-neutral*` no longer exists and renders nothing. Never use palette colors or `opacity-*` to dim text, because opacity dims differently depending on what sits behind it.
- A field label is `label` (13px, medium). Typed text in an `Input` or `SearchInput` is also `label`, medium everywhere since #25317. Multi-line `Textarea` text stays `body-sm`, regular, because it reads as prose. All of these come from the control, so never set a role on a control or its value.
- `FieldLabel size="smaller"` (`column`) is for compact rows such as a switch beside a toolbar label, and `size="bigger"` (`body`) is for a field that leads its form. Otherwise leave the default. A label is never `caption`.
- Help text is a visible `FieldDescription` under the control, `caption` + muted. Validation is a `FieldError`, `body-sm` in destructive red with its icon: an error must read at the size of the label and value it sits under, and 12px red reads thin in dark mode. Both explain the control, so neither is `label`. Whether a field gets help text at all is a copy decision in `copy.md`.
- A required marker sits inside the label and keeps its role; `FieldLabel required` draws it in destructive red. A disabled field changes only color, to `muted`, and never size or weight.
- 500 is the weight ceiling. No text in a product surface is semibold or bold, KPI values included. Factory card titles are the one exception: `card-title` and `card-title-tight` are 550 and `card-title-strong` is 600, and they are for Factory work-item and candidate titles only ([#25784](https://github.com/mastra-ai/mastra/pull/25784)).
- Heading elements (`h1` to `h6`) follow document order regardless of the visual role. Never shrink a heading to `caption` or `meta` to fit.
- Roles do not change at breakpoints. A page title on mobile is still a page title; change wrapping or layout instead.
- A reusable component that shows text at more than one level exposes a `children` or text slot, with its most common role as the default.
- Raw `text-xs|sm|base|lg|xl` and `text-[Npx]` fail lint and are never correct. In `playground-ui`, lint skips `src/ee/**`, so these rules hold there without the safety net.
- On a `Txt`, ink is only the `tone` prop. A `text-foreground`, `text-muted-foreground`, or `text-placeholder` class on `Txt` fails lint; hover and alpha variants (`hover:text-foreground`, `text-foreground/70`) stay classes because `tone` cannot express them.

## Monospace and code

Monospace is a typeface, not a role (#25012, shipped in `@mastra/playground-ui` 59.0.0). `Txt font="mono"` keeps the role's size, line-height, and weight and swaps only the family, so a mono value lines up with the text beside it.

```text
Is it code: a snippet, command, package, env var, or variable name?
|-- In a sentence              -> <InlineCode>OPENAI_API_KEY</InlineCode>
\-- More than one line         -> <CodeBlock lang="ts" code={…} />
Is it a machine identifier a user copies or compares by character (ID, hash, model ID, version, log line)?
\-- Yes -> <Txt variant="body-sm" font="mono">run_01JQX8K2M4</Txt>
Is it time inline in text or a table row: a timestamp or a duration (Sep 23, 12:42, 3m ago, 412ms, 1h 20m)?
\-- Yes -> mono: RelativeTimestamp for a moment (see copy.md), Txt font="mono" for an absolute time or a duration
Is it another number: a count, cost, score, or percentage?
\-- Yes -> body face with tabular-nums where digits must line up (table columns)
Is it a KPI value, a chart axis, or a chart tooltip?
\-- Yes -> body face with tabular-nums, even for timestamps and durations
Anything else (labels, headings, status, badges, prose, empty states) -> body face, never mono
```

- Mono pairs with the roles: `body` for log lines, `body-sm` for values in tables, `caption` for secondary identifiers, `meta` for compact values like versions. Heading roles are never mono.
- Product code never writes the `font-mono` class; lint rejects it outside `playground-ui/src/ds`. A raw `<pre>` or `<code>` is already mono.
- Code is always marked as code: never plain or mono text, and never a hand-styled `<code className="rounded bg-…">`. JSON or markdown the user edits goes in `CodeEditor`, not a `Textarea`.
- Data visualization stays in one face: `MetricsKpiCard` values, chart axes, and chart tooltips are proportional with `tabular-nums`, because a latency KPI beside cost and count KPIs, or a latency chart beside a count chart, would otherwise mix faces in one row.
- Do not put a count inside a mono run: a duration and a token count are `<Txt font="mono">412ms</Txt>` and `1,204 tokens` in the body face with `tabular-nums`, as two items in a `gap-*` row.

</instructions>

<quality-checklist>
- [ ] Every text node has a role from the tree, and tones come from `tone`
- [ ] Mono only on identifiers, timestamps, durations (`Txt font="mono"`, `RelativeTimestamp`), and code (`InlineCode`, `CodeBlock`); counts, costs, and scores use the body face with `tabular-nums`; no `font-mono` class
</quality-checklist>
