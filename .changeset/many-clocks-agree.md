---
'@mastra/playground-ui': minor
---

**Improved** Dates and times now follow the browser's locale and clock everywhere. Chart labels, the trace and log histograms, the date range picker, date fields and timelines used to always show US formats (`Nov 24, 2 PM`). A 24-hour browser now sees `24 Nov, 14:00`, and hours get a leading zero where the locale writes one (`09:05`).

**Added** `formatClock` for short chart times, and the `day-time`, `date-year` and `date-long` presets on `formatDate`.

```ts
import { formatClock, formatDate } from '@mastra/playground-ui/utils/date-format';

formatClock(date); // "2 PM" in en-US, "14:00" in en-GB
formatDate(date, 'day-time'); // "Nov 24, 2:05 PM" in en-US, "24 Nov, 14:05" in en-GB
```

**Added** the `playground-ui/date-locale` lint rule to the `recommended` preset. It flags a pinned locale, a forced 12-hour or 24-hour clock, and date-fns display patterns.

```ts
// oxlint.config.ts
import { recommended } from '@mastra/playground-ui/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: ['@mastra/playground-ui/oxlint'],
  rules: { ...recommended },
});
```
