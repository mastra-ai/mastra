import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a date follows the browser, or is not text people read', run);
  if (name === 'invalid') return describe('when a date is pinned to one locale or clock', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

const errors = (count = 1) =>
  Array.from({ length: count }, () => ({
    message:
      "Dates and times follow the browser's locale and clock. Use formatDate or formatClock from @mastra/playground-ui/utils/date-format, or Intl with an undefined locale and no hour12 or hourCycle.",
  }));

tester.run('date-locale', plugin.rules['date-locale'], {
  valid: [
    {
      name: 'allows the browser locale',
      code: "d.toLocaleDateString(); d.toLocaleTimeString(undefined, { hour: 'numeric' }); d.toLocaleString([], { timeStyle: 'short' }); new Intl.DateTimeFormat(undefined, { month: 'short' });",
    },
    {
      name: 'allows a locale from a variable',
      code: 'd.toLocaleDateString(locale); new Intl.DateTimeFormat(locale, { hour12 });',
    },
    {
      name: 'ignores number, list and plural formats',
      code: "count.toLocaleString('en-US'); count.toLocaleString('en-US', { maximumFractionDigits: 2 }); new Intl.NumberFormat('en-US'); new Intl.PluralRules('en');",
    },
    {
      name: 'allows reading the browser clock',
      code: 'const { hour12, hourCycle } = new Intl.DateTimeFormat().resolvedOptions();',
    },
    {
      name: 'ignores an option named by a variable',
      code: "new Intl.DateTimeFormat(undefined, { hour: 'numeric', [hour12]: 'short' });",
    },
    {
      name: 'ignores a clock setting that formats nothing',
      code: "save({ theme: 'dark', hour12: true }); save({ year: 2026, month: 11, hour: 14, hour12: false });",
    },
    {
      name: 'allows date-fns patterns that are data',
      code: "import { format } from 'date-fns'; format(d, 'yyyy-MM-dd'); format(d, \"yyyy-MM-dd'T'HH:mm:ss\"); format(d, 'HH:mm'); format(d, API_FORMAT);",
    },
    {
      name: 'ignores other functions named format',
      code: "import { format } from './money'; format(value, 'MMM d');",
    },
    {
      name: 'ignores a local that shadows the date-fns import',
      code: "import { format } from 'date-fns'; function render(format) { return format(value, 'currency'); }",
    },
  ],
  invalid: [
    {
      name: 'flags a pinned locale on dates',
      code: "d.toLocaleDateString('en-US'); d.toLocaleTimeString(['en-GB']); d.toLocaleString('en-US', { month: 'short' }); new Date().toLocaleString('en-US'); d.toLocaleString('en-US', { fractionalSecondDigits: 3 });",
      errors: errors(5),
    },
    {
      name: 'flags a pinned locale on Intl.DateTimeFormat',
      code: "new Intl.DateTimeFormat('en-US', { month: 'short' }); Intl.DateTimeFormat(`en-US`);",
      errors: errors(2),
    },
    {
      name: 'flags a forced clock',
      code: "d.toLocaleTimeString(undefined, { hour12: false }); new Intl.DateTimeFormat(undefined, { timeStyle: 'short', hourCycle: 'h23' }); const OPTIONS = { hour: '2-digit', hour12: true };",
      errors: errors(3),
    },
    {
      name: 'flags date-fns display patterns',
      code: "import { format, formatDate as fmt } from 'date-fns'; format(d, 'MMM d, h:mm a'); fmt(d, 'PP p'); format(d, 'yyyy-MMMM d');",
      errors: errors(3),
    },
    {
      name: 'flags date-fns display patterns through a namespace',
      code: "import * as dates from 'date-fns'; dates.format(d, 'MMM d');",
      errors: errors(),
    },
  ],
});
