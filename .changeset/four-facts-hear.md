---
'@mastra/playground-ui': minor
---

Improved breadcrumbs so they read cleaner and behave the same everywhere:

- Replaced the slash between crumbs with a dim chevron, with an even 14px gap on both sides.
- Added an up-down chevron right after an entity switcher's name. Next to a link, the name and the switcher hover separately, so it's clear which one you're about to click.
- Unified the controls after a crumb's name (the switcher, or an action such as copy): same size, gap and circular hover, through a new `icon-inline` size on `Button`, `CopyButton` and `Combobox` for icon controls that sit inside a line of text.
- Unified crumb icons to one size across icon sets.
- Fixed focus rings on crumbs being cut off at the edges of the breadcrumb.

`Combobox` takes a new `chevron` prop for compact triggers. `crumbSwitcherTriggerProps` already sets it, so breadcrumb switchers pick it up:

```tsx
const [projectId, setProjectId] = useState('demo-agents');

<Combobox
  options={projects}
  value={projectId}
  onValueChange={setProjectId}
  variant="ghost"
  size="icon-sm"
  chevron="up-down"
  aria-label="Switch project"
/>;
```
