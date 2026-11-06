# 0008: Filter fields are gray

**Decision**: every `FilterBar` field, the time range included, labels its chip in `--muted-foreground`. No field gets its own hue.

**Scope**: filter chips and the field step of the filter input, on every page. Data colors in charts and badges are unaffected.

**Why**: a hue per field gave each chip a color that meant nothing a reader could learn, and it competed with the colors on the page that do carry meaning, such as status and chart series.

**Evidence**: PR [#26269](https://github.com/mastra-ai/mastra/pull/26269), commit `b5cea6d`, "fix(playground-ui): use gray filter accents": "All built-in filters, Time, and dynamic metadata filters now use the existing neutral gray theme token. Removes the curated and hashed filter colors." Studio's Traces and Metrics bars follow it through `traceFilterFieldColor` in `src/domains/traces/trace-filters.ts`.

**Rejected**: the hue-per-field accents (`hueAccentColor`) that the `Composite/FilterBar` stories and several Studio filter bars still show.

**Approved by**: merged in #26269, 2026-10-08.

**Reaches**: `rg -n "hueAccentColor" packages mastracode --glob '*.tsx' --glob '*.ts'`
