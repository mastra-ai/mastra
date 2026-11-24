import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a page takes its width from a layout', run);
  if (name === 'invalid') return describe('when a page centres a column of its own', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

tester.run('no-page-width', plugin.rules['no-page-width'], {
  valid: [
    { name: 'allows a layout with no width classes', code: '<PageLayout><section className="mt-6" /></PageLayout>;' },
    { name: 'allows a max width without centring', code: '<div className="max-w-120 flex-1" />;' },
    { name: 'allows centring without a max width', code: '<div className="mx-auto size-8" />;' },
    { name: 'ignores lookalike classes', code: '<div className="sm:mx-auto max-width-note" />;' },
  ],
  invalid: [
    { name: 'flags a centred max-width column', code: '<div className="mx-auto w-full max-w-2xl" />;', errors: 1 },
    { name: 'flags an arbitrary max width', code: '<div className="mx-auto max-w-[80rem]" />;', errors: 1 },
    {
      name: 'flags a shared class constant',
      code: "export const SETTINGS_COLUMN = 'mx-auto w-full max-w-2xl';",
      errors: 1,
    },
    { name: 'flags a template literal', code: 'const c = `mx-auto max-w-5xl ${extra}`;', errors: 1 },
    {
      name: 'flags classes split across lines',
      code: 'const c = `mx-auto w-full\n  max-w-2xl`;',
      errors: 1,
    },
  ],
});
