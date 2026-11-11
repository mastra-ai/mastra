---
'@mastra/playground-ui': minor
'@mastra/mcp-apps-components': patch
---

Replaced the `onPin` and `isPinned` props on `DashboardRenderer`, and the `pin` prop on `StatelessWidget`, with a host `actions` slot. `DashboardRenderer` takes a `widgetActions` callback that returns each widget's buttons, and `StatelessWidget` takes them as `actions`. This lets a host add any buttons to widget cards, not just a pin button, without changing the renderer. Host buttons sit after the card's own drilldown and alert buttons.

Compose the buttons with the new `MetricsCard.Action`. The card is a `group/metrics-card`, so each button sets its own visibility with classes. The exported `onCardHover` class makes a button wait for the card's hover, keyboard focus or open menu: until then it takes no room but stays in the tab order, so keyboard users can still reach it. Without it, the button stays in view, e.g. for a pinned card's unpin; on touch screens, such a button also keeps a KPI group's floating controls reachable. `PinAction` and the `WidgetPin` type are removed: a pin button is a `MetricsCard.Action` like any other.

`ChartCard` now has a single `actions` slot: `persistentActions` is removed, and `MetricsCard.Actions` no longer takes `reveal`. Set `className={onCardHover}` on each `MetricsCard.Action` that should wait for hover instead.

**Before**

```tsx
<DashboardRenderer
  definition={definition}
  scope="project"
  isPinned={id => pinnedIds.includes(id)}
  onPin={(widget, isPinned) => savePin(widget, isPinned)}
/>
```

**After**

```tsx
import { MetricsCard, onCardHover } from '@mastra/playground-ui/components/MetricsCard';
import { DashboardRenderer } from '@mastra/playground-ui/domains/dashboards';
import { PinIcon, PinOffIcon } from 'lucide-react';

<DashboardRenderer
  definition={definition}
  scope="project"
  widgetActions={widget => {
    const isPinned = pinnedIds.includes(widget.id);
    return (
      <MetricsCard.Action
        label={`${isPinned ? 'Unpin' : 'Pin'} ${widget.title ?? 'widget'}`}
        onClick={() => savePin(widget, !isPinned)}
        className={isPinned ? undefined : onCardHover}
      >
        {isPinned ? <PinOffIcon /> : <PinIcon />}
      </MetricsCard.Action>
    );
  }}
/>;
```
