---
'@mastra/playground-ui': minor
---

Added the Factory board canvas under `@mastra/playground-ui/domains/factory`: the canvas frame and view tabs, the phase flow with its phase cards and rule chips, condition cells, the routing view, and the phase, rule and test side panels. Each piece takes its data as props and reports edits through callbacks, so the host app keeps its own data fetching and routes. Links render through the host's `LinkComponent`.

```tsx
import { CanvasFrame, CanvasViewTabs } from '@mastra/playground-ui/domains/factory';

<CanvasFrame
  label="Work board"
  tabs={
    <CanvasViewTabs
      active="settings"
      cardsHref="/boards/work"
      settingsHref="/boards/work/config"
      routingHref="/boards/work/intake"
      LinkComponent={RouterLink}
    />
  }
>
  {flow}
</CanvasFrame>;
```

**Removed** the earlier board settings pieces the canvas replaces: `BoardMap`, `BoardMapColumn`, `BoardSettingsColumn`, `BoardConfigNav`, `BoardConfigNavLink`, `BoardConfigPhaseLinks`, `PhaseRunFields`, `PhaseField`, `MarkdownCard`, and the `BOARD_MAP_*`, `BOARD_SETTINGS_COLUMN` and `BOARD_OVERVIEW_SURFACE` class constants. They were added earlier in this prerelease. `phaseRunFieldsValid`, `phaseGoalRunsValid` and the `MAX_PHASE_*` limits stay.
