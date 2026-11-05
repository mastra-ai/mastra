---
'@mastra/playground-ui': minor
---

Breadcrumbs look cleaner and more consistent:

- A dim chevron replaces the slash between crumbs, with an even 14px gap on both sides.
- Entity switchers in breadcrumbs show an up-down chevron right after the name. Next to a link, the name and the switcher now hover separately, so it's clear which one you're about to click.
- Controls after a crumb's name (the switcher, or an action such as copy) share one size, gap and circular hover.
- Crumb icons draw at one size across icon sets.
- Focus rings on crumbs are no longer cut off at the edges of the breadcrumb.

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
