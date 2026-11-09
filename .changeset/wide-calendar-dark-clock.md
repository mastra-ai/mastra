---
'@mastra/playground-ui': minor
---

`DatePicker` now fills the width of its container. Before, it kept its content width and left an empty strip inside a wider popover. Popovers that size to their content look the same. A width class passed through `className` (for example `w-fit`) still replaces the default.

Added `TimeInput`, a time field that shows a design-system clock icon instead of the browser's native picker icon. The clock looks the same in every theme and browser, and clicking it opens the native picker where the browser has one. Below 6rem the clock hides so the time value isn't clipped. `DateTimePicker` and the custom range editor in `DateTimeRangePicker` now use it.

```tsx
import { TimeInput } from '@mastra/playground-ui/components/Input';

<TimeInput size="sm" aria-label="Time" value={time} onChange={e => setTime(e.target.value)} className="w-24" />;
```

`Input` now uses a dark color-scheme in dark mode, so native controls such as the time picker popup render dark.
