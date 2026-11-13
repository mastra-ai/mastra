import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

const message =
  'Name the transitioned properties (transition-colors, transition-opacity, transition-transform, transition-[…]) instead of transition-all.';

tester.run('no-transition-all', plugin.rules['no-transition-all'], {
  valid: [
    { code: '<div className="transition-colors duration-normal" />;' },
    { code: '<div className="transition-[height] duration-normal" />;' },
    { code: '<div className="motion-reduce:transition-none" />;' },
  ],
  invalid: [
    { code: '<div className="transition-all duration-normal" />;', errors: [{ message }] },
    { code: '<div className="flex transition-all" />;', errors: [{ message }] },
    { code: '<div className="hover:transition-all" />;', errors: [{ message }] },
    { code: 'cn("flex", `transition-all ${x}`);', errors: [{ message }] },
  ],
});
