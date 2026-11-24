import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a delay is named, left out or not a hover delay', run);
  if (name === 'invalid') return describe('when a call site sets its own time', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });
const trigger = {
  message: 'Drop this to use the default delay, or pass delay="instant" when the target exists to be hovered.',
};
const provider = {
  message:
    'TooltipProvider sets no delay. Drop this, and pass delay="instant" to a TooltipTrigger that exists to be hovered.',
};

tester.run('no-hover-delay-numbers', plugin.rules['no-hover-delay-numbers'], {
  valid: [
    { name: 'allows the default', code: '<TooltipTrigger />;' },
    { name: 'allows a named delay', code: '<TooltipTrigger delay="instant" />;' },
    {
      name: 'allows a named delay that depends on state',
      code: "<HoverCardTrigger delay={dense ? 'instant' : 'default'} />;",
    },
    {
      name: 'allows a number in the condition that picks a named delay',
      code: "<TooltipTrigger delay={items.length > 0 ? 'instant' : 'default'} />;",
    },
    { name: 'allows a bare provider', code: '<TooltipProvider><App /></TooltipProvider>;' },
    { name: 'leaves other components alone', code: '<Toast delay={300} />;' },
  ],
  invalid: [
    { name: 'flags a number on a tooltip', code: '<TooltipTrigger delay={0} />;', errors: [trigger] },
    {
      name: 'flags a number behind a condition',
      code: '<TooltipTrigger delay={busy ? 0 : undefined} />;',
      errors: [trigger],
    },
    {
      name: 'flags both times on a hover card',
      code: '<HoverCardTrigger delay={0} closeDelay={100} />;',
      errors: [trigger, trigger],
    },
    { name: 'flags a hover popover', code: '<PopoverTrigger openOnHover delay={100} />;', errors: [trigger] },
    {
      name: 'flags a provider that sets the delay',
      code: '<TooltipProvider delayDuration={0} skipDelayDuration={0} />;',
      errors: [provider, provider],
    },
    {
      name: 'flags a provider delay passed through a prop',
      code: '<TooltipProvider delay={delay} />;',
      errors: [provider],
    },
  ],
});
