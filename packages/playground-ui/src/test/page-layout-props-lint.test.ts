import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a page uses the current PageLayout API', run);
  if (name === 'invalid')
    return describe('when a PageLayout is missing its variant or passes a prop it does not take', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

const pickVariant =
  'variant="form" for a create or edit form (title and back link, no breadcrumbs), variant="settings" for a settings page (breadcrumbs, title, sections), variant="page" for anything else, adding body="fixed" when its panels scroll on their own (chat, board, editor, graph).';

tester.run('page-layout-props', plugin.rules['page-layout-props'], {
  valid: [
    {
      name: 'allows the page variants',
      code: '<><PageLayout variant="page" body="fixed" breadcrumbs={crumbs}>{panels}</PageLayout><PageLayout variant="settings" breadcrumbs={crumbs} title="General">{body}</PageLayout><PageLayout variant="form" backHref="/" backLabel="Agents" title="New">{body}</PageLayout></>;',
    },
    { name: 'allows a variant forwarded from a wrapper', code: '<PageLayout variant={variant}>{body}</PageLayout>;' },
    { name: 'allows props spread from a wrapper', code: '<PageLayout {...props}>{body}</PageLayout>;' },
    {
      name: 'ignores variant inside a slot when reading the page variant',
      code: '<PageLayout variant="page" breadcrumbs={<Crumb variant="form" />}>{body}</PageLayout>;',
    },
    { name: 'ignores variant on other components', code: '<EmptyState variant="fill" />;' },
    { name: 'ignores mask on a scroll area', code: '<ScrollArea mask={false} />;' },
  ],
  invalid: [
    {
      name: 'tells a page without a variant how to pick one',
      code: '<PageLayout breadcrumbs={crumbs}>{body}</PageLayout>;',
      errors: [{ message: `PageLayout needs a variant. Use ${pickVariant}` }],
    },
    {
      name: 'sends the removed fit variant to a fixed body',
      code: '<PageLayout variant="fit" breadcrumbs={crumbs} />;',
      errors: [
        {
          message:
            'PageLayout has no fit variant. Use variant="page" body="fixed": the page stays put and its panels scroll on their own.',
        },
      ],
    },
    {
      name: 'sends the removed narrow variant to form or settings',
      code: '<PageLayout variant="narrow">{body}</PageLayout>;',
      errors: [
        {
          message:
            'PageLayout has no narrow variant. Use variant="form" for a create or edit form (title and back link, no breadcrumbs) or variant="settings" for a settings page (breadcrumbs, title, sections). A list or dashboard takes variant="page".',
        },
      ],
    },
    {
      name: 'tells the removed container variant how to pick one',
      code: '<PageLayout variant="container">{body}</PageLayout>;',
      errors: [{ message: `PageLayout has no container variant. Use ${pickVariant}` }],
    },
    {
      name: 'sends breadcrumbs on a form to its back link',
      code: '<PageLayout variant="form" breadcrumbs={crumbs} headerActions={actions} title="New">{body}</PageLayout>;',
      errors: 2,
    },
    {
      name: 'flags body on a form',
      code: '<PageLayout variant="form" body="fixed" title="New">{body}</PageLayout>;',
      errors: [{ message: 'Only variant="page" takes body. A form is a 640px column that scrolls with the page.' }],
    },
    {
      name: 'flags body on a settings page',
      code: '<PageLayout variant="settings" body="fixed">{body}</PageLayout>;',
      errors: [
        { message: 'Only variant="page" takes body. A settings page is a 640px column that scrolls with the page.' },
      ],
    },
    {
      name: 'flags the removed mask prop',
      code: '<PageLayout variant="page" mask={false}>{body}</PageLayout>;',
      errors: [{ message: 'PageLayout has no mask. Drop the prop.' }],
    },
  ],
});
