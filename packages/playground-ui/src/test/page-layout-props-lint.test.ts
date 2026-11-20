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
      name: 'allows a workspace body',
      code: '<PageLayout breadcrumbs={crumbs}><PageLayout.Workspace>{panels}</PageLayout.Workspace></PageLayout>;',
    },
    { name: 'ignores variant on other components', code: '<EmptyState variant="fill" />;' },
    { name: 'ignores mask on a scroll area', code: '<ScrollArea mask={false} />;' },
  ],
  invalid: [
    { name: 'flags the removed fit variant', code: '<PageLayout variant="fit" breadcrumbs={crumbs} />;', errors: 1 },
    { name: 'flags a variant from an expression', code: '<PageLayout variant={kind}>{body}</PageLayout>;', errors: 1 },
    { name: 'flags the removed mask prop', code: '<PageLayout mask={false}>{body}</PageLayout>;', errors: 1 },
  ],
});
