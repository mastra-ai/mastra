---
'@mastra/playground-ui': minor
---

Improved breadcrumbs so they read cleaner and behave the same everywhere:

- Replaced the slash between crumbs with a dim chevron, with an even 14px gap on both sides.
- Added an up-down chevron right after an entity switcher's name. Next to a link, the name and the switcher hover separately, so it's clear which one you're about to click.
- Unified the controls after a crumb's name (the switcher, or an action such as copy): same size, gap and circular hover, through a new `icon-inline` size on `Button`, `CopyButton` and `Combobox` for icon controls that sit inside a line of text.
- Unified crumb icons to one size across icon sets.
- Fixed focus rings on crumbs being cut off at the edges of the breadcrumb.

Icon-only `Combobox` triggers now draw an up-down chevron, since without value text they switch between peers. For an icon control inside a line of text, use the new `icon-inline` size:

```tsx
<CopyButton content={runId} tooltip="Copy run id" variant="ghost" size="icon-inline" />
```
