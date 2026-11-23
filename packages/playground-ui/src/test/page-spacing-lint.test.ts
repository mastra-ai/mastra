import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a page takes its spacing from PageLayout', run);
  if (name === 'invalid') return describe('when a page sets spacing of its own', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });

tester.run('no-page-spacing', plugin.rules['no-page-spacing'], {
  valid: [
    {
      name: 'allows sections stacked 24px apart',
      code: '<PageLayout variant="page"><div className="flex flex-col gap-6">{sections}</div></PageLayout>;',
    },
    {
      name: 'allows space-y-6',
      code: '<PageLayout variant="page"><div className="space-y-6">{sections}</div></PageLayout>;',
    },
    {
      name: 'allows a row gap on a horizontal body',
      code: '<PageLayout variant="page"><div className="flex items-center gap-2">{chips}</div></PageLayout>;',
    },
    {
      name: 'allows a filled body',
      code: '<PageLayout variant="page"><div className="h-full">{empty}</div></PageLayout>;',
    },
    {
      name: 'allows spacing deeper inside a section',
      code: '<PageLayout variant="page"><div className="flex flex-col gap-6"><section className="pb-3 mt-2" /></div></PageLayout>;',
    },
    {
      name: 'allows a header with no spacing of its own',
      code: '<PageLayout variant="page" header={<div className="flex items-center justify-between gap-4">{title}</div>}>{body}</PageLayout>;',
    },
    {
      name: 'allows a header that stacks its own title and description',
      code: '<PageLayout variant="page" header={<div className="flex flex-col gap-1">{title}{description}</div>}>{body}</PageLayout>;',
    },
    {
      name: 'leaves a fixed body to its panels, which own their spacing',
      code: '<PageLayout variant="page" body="fixed"><div className="flex min-h-0 flex-col p-4">{panels}</div></PageLayout>;',
    },
    {
      name: 'leaves the parts of a composed header to the header',
      code: '<PageLayout variant="settings" header={<><PageHeader /><div className="mt-3"><Button /></div></>}>{body}</PageLayout>;',
    },
    {
      name: 'checks each branch of a conditional class on its own',
      code: "<PageLayout variant=\"page\"><div className={vertical ? 'flex flex-col gap-6' : 'flex items-center gap-2'} /></PageLayout>;",
    },
    {
      name: 'keeps conditionals on the same test in step across cn() arguments',
      code: "<PageLayout variant=\"page\"><div className={cn('flex', vertical ? 'flex-col' : 'flex-row', vertical ? 'gap-6' : 'gap-2')} /></PageLayout>;",
    },
    {
      name: 'keeps an && class in step with a conditional on the same test',
      code: "<PageLayout variant=\"page\"><div className={cn('flex', vertical && 'flex-col', vertical ? 'gap-6' : 'gap-2')} /></PageLayout>;",
    },
    {
      name: 'allows a horizontal gap on a multi-column grid',
      code: '<PageLayout variant="page"><div className="grid grid-cols-3 gap-4">{cards}</div></PageLayout>;',
    },
    {
      name: 'ignores elements outside a PageLayout',
      code: '<Card><div className="mt-6 pb-16" /></Card>;',
    },
  ],
  invalid: [
    {
      name: 'flags a top margin under the header',
      code: '<PageLayout variant="page" header={header}><div className="mt-6 flex flex-col gap-6" /></PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags bottom padding at the end of the page',
      code: '<PageLayout variant="page"><div className="flex flex-col gap-6 pb-16" /></PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags responsive padding',
      code: '<PageLayout variant="page"><div className="space-y-6 pb-24 sm:pb-32" /></PageLayout>;',
      errors: 2,
    },
    {
      name: 'flags a section gap off the 24px rhythm',
      code: '<PageLayout variant="page"><div className="flex flex-col gap-10" /></PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags space-y off the rhythm',
      code: '<PageLayout variant="page"><div className="space-y-14" /></PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags spacing on a conditional body',
      code: '<PageLayout variant="page">{empty ? <EmptyState /> : <div className="mt-6 space-y-6" />}</PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags an off-rhythm gap in the vertical branch of a conditional class',
      code: "<PageLayout variant=\"page\"><div className={vertical ? 'flex flex-col gap-4' : 'flex items-center gap-2'} /></PageLayout>;",
      errors: 1,
    },
    {
      name: 'flags an off-rhythm gap that a shared column class makes vertical',
      code: "<PageLayout variant=\"page\"><div className={cn('flex flex-col', dense ? 'gap-4' : 'gap-6')} /></PageLayout>;",
      errors: 1,
    },
    {
      name: 'flags an off-rhythm gap whose condition is independent of the direction',
      code: "<PageLayout variant=\"page\"><div className={cn('flex', vertical ? 'flex-col' : 'flex-row', dense ? 'gap-4' : 'gap-6')} /></PageLayout>;",
      errors: 1,
    },
    {
      name: 'flags an off-rhythm gap on a single-column grid',
      code: '<PageLayout variant="page"><div className="grid grid-cols-1 gap-10" /></PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags spacing inside a cn() call',
      code: "<PageLayout variant=\"page\"><div className={cn('space-y-6', !bare && 'pt-6')} /></PageLayout>;",
      errors: 1,
    },
    {
      name: 'flags spacing on a component passed as the body',
      code: '<PageLayout variant="page"><DashboardGrid className="pb-6" /></PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags padding under the header of a fixed page',
      code: '<PageLayout variant="page" body="fixed" header={<div className="pb-3">{title}</div>}>{panels}</PageLayout>;',
      errors: 1,
    },
    {
      name: 'flags padding under a custom header',
      code: '<PageLayout variant="page" header={<div className="pb-4"><Filters /></div>}>{body}</PageLayout>;',
      errors: 1,
    },
  ],
});
