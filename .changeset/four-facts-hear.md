---
'@mastra/playground-ui': minor
---

Breadcrumbs look cleaner and more consistent:

- A dim chevron replaces the slash between crumbs, with an even 14px gap on both sides.
- Entity switchers in breadcrumbs show an up-down chevron right after the name. Next to a link, the name and the switcher now hover separately, so it's clear which one you're about to click.
- Crumb icons draw at one size across icon sets.
- Focus rings on crumbs are no longer cut off. Pass `overflow-clip` instead of `overflow-hidden` on `Breadcrumb` to truncate a long trail.

`Combobox` takes a new `chevron` prop (`'down'` or `'up-down'`); `crumbSwitcherTriggerProps` sets `'up-down'`.
