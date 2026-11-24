---
'@mastra/playground-ui': minor
---

Added a default tooltip delay and a named `delay` for the few that differ. Tooltips, hover cards and `openOnHover` popovers now open after a 300ms pause by default, with or without a `TooltipProvider`. Info icons, chart points and meters open instantly, as does keyboard focus, the tooltip next to one that is open, and the tooltip of a disabled button. Hover cards now close 100ms after the pointer leaves (was 300ms).

`delay="instant"` replaces milliseconds. Numbers on triggers and the `delay`, `delayDuration`, `timeout` and `skipDelayDuration` props of `TooltipProvider` still work but are deprecated. To get the new default, drop them from the provider at your app's root:

```tsx
// Before
<TooltipProvider delayDuration={0}>
  <App />
</TooltipProvider>
<TooltipTrigger delay={0} aria-label="42 runs" />

// After
<TooltipProvider>
  <App />
</TooltipProvider>
<TooltipTrigger delay="instant" aria-label="42 runs" />
```

Added the `playground-ui/no-hover-delay-numbers` lint rule to the `recommended` preset. It flags milliseconds on tooltip, hover card and popover triggers, and any delay on `TooltipProvider`.
