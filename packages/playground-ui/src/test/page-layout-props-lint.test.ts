import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a page uses the current PageLayout API', run);
  if (name === 'invalid') return describe('when a page passes a removed PageLayout prop', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

tester.run('page-layout-props', plugin.rules['page-layout-props'], {
  valid: [
    {
      name: 'allows the page variants',
      code: '<><PageLayout variant="page" body="fixed" breadcrumbs={crumbs}>{panels}</PageLayout><PageLayout variant="settings">{body}</PageLayout><PageLayout variant="form" title="New">{body}</PageLayout></>;',
    },
    { name: 'allows a variant forwarded from a wrapper', code: '<PageLayout variant={variant}>{body}</PageLayout>;' },
    { name: 'ignores variant on other components', code: '<EmptyState variant="fill" />;' },
    { name: 'ignores mask on a scroll area', code: '<ScrollArea mask={false} />;' },
  ],
  invalid: [
    { name: 'flags the removed fit variant', code: '<PageLayout variant="fit" breadcrumbs={crumbs} />;', errors: 1 },
    { name: 'flags the removed narrow variant', code: '<PageLayout variant="narrow">{body}</PageLayout>;', errors: 1 },
    {
      name: 'flags the removed container variant',
      code: '<PageLayout variant="container">{body}</PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags the removed mask prop',
      code: '<PageLayout variant="page" mask={false}>{body}</PageLayout>;',
      errors: 1,
    },
  ],
});
