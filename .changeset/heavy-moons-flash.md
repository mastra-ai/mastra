---
'@mastra/playground-ui': patch
---

Moved the card and tab surfaces onto the semantic color contract.

`DashboardCard`, `MetricsKpiCard`, `Tabs`, and `TabbedContainer` now read their surfaces, borders, and text from `card`, `muted`, `border`, `selected`, `foreground`, and `muted-foreground` instead of the legacy `surface*`, `border1`, and `neutral*` tokens.

**What changes visually**

Cards are an opaque surface instead of a translucent overlay, so a card looks the same on any background. The inset tab panel uses that same card surface, so a panel and a standalone card match, and the frame around it uses the recessed `muted` surface. On a near-black page a card reads lighter than before.

`MetricsKpiCard` also moves onto the shared text hierarchy. The value drops from `header-lg` to `header-md`, the label gains `font-medium`, and the four state messages (`Change`, `NoChange`, `NoData`, `Error`) are all `ui-sm` — previously `Error` rendered a size smaller than its siblings in the same slot.

**Why**

A translucent card picks up whatever sits behind it. The inset tab panel sits on the tab frame rather than the page, so it could never match a card beside it, and consumers were overriding the colors locally to line the two up. An opaque card surface removes that class of workaround.

**Also fixed**

A tab's close control took its tooltip and accessible name from the tab's children, so a tab built from an icon, a label, and a count badge produced a tooltip with all three stacked vertically and an accessible name of `Close Traces248`. Close controls now use a plain-text form of the label.

In the overflow menu, the close control registered itself as a menu row, so the travelling hover highlight shrank from the full row onto the 24px icon. It now stays on the row, by pointer and by keyboard.

Component APIs, sizing, spacing, and the 4px inset are unchanged.
