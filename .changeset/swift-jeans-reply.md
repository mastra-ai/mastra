---
'@mastra/playground-ui': minor
---

Added illustrated info tooltips, and info tooltips now open on a tap on touch screens.

**Illustrated tooltips.** Pass `variant="illustrated"` to `InfoTooltip` and put one `InfoTooltip.Panel` per outcome inside it. Each panel takes a `title`, a `caption`, and a small drawing as children. Panels sit in equal columns that line up, and the drawing is hidden from screen readers, which read each title and caption instead.

```tsx
<InfoTooltip aria-label="About alerting for each" variant="illustrated">
  <InfoTooltip.Panel title="All traffic" caption="One failing agent can be hidden by healthy ones.">
    <CombinedLevel />
  </InfoTooltip.Panel>
  <InfoTooltip.Panel title="Each agent" caption="The failing agent gets its own alert.">
    <LevelPerAgent />
  </InfoTooltip.Panel>
</InfoTooltip>
```

**Touch.** Tapping the info icon opens the tooltip, and tapping it again or anywhere else closes it. Before, info tooltips never opened on phones. Hover and keyboard focus work as before. The info icon now shows the normal arrow cursor instead of the help cursor, since a mouse click doesn't open it.

See the Tooltip docs page in Storybook for when to use a text tooltip, an illustrated tooltip, or a popover, and a checklist for drawing the diagrams.
