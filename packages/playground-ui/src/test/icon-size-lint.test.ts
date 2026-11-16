import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when an icon takes its size from its parent or a token', run);
  if (name === 'invalid') return describe('when an icon sets a size of its own', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });
const iconImport = "import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';";

tester.run('icon-size-from-parent', plugin.rules['icon-size-from-parent'], {
  valid: [
    { name: 'allows an unsized icon', code: `${iconImport} <Button><IconPlusMedium /></Button>;` },
    {
      name: 'allows a size token',
      code: `${iconImport} <IconPlusMedium className="text-muted-foreground size-icon-sm" />;`,
    },
    { name: 'allows filling the parent box', code: `${iconImport} <IconPlusMedium className="size-full" />;` },
    {
      name: 'allows the Icon wrapper to take a size',
      code: `${iconImport} <Icon size="sm"><IconPlusMedium /></Icon>;`,
    },
    { name: 'ignores components that are not imported icons', code: '<Avatar size={24} className="size-6" />;' },
    {
      name: 'allows a size relative to the surrounding text',
      code: `${iconImport} <IconPlusMedium className="h-[1em] w-[1em]" />;`,
    },
    {
      name: 'allows a size computed from data',
      code: `${iconImport} <IconPlusMedium size={Math.round(badge * 0.6)} />;`,
    },
    { name: 'ignores min and max widths', code: `${iconImport} <IconPlusMedium className="min-w-0 max-h-4" />;` },
  ],
  invalid: [
    { name: 'flags a size prop', code: `${iconImport} <IconPlusMedium size={14} />;`, errors: 1 },
    {
      name: 'flags width and height props',
      code: `${iconImport} <IconPlusMedium width={16} height={16} />;`,
      errors: 2,
    },
    { name: 'flags a size class', code: `${iconImport} <IconPlusMedium className="shrink-0 size-4" />;`, errors: 1 },
    {
      name: 'flags height and width classes',
      code: `${iconImport} <IconPlusMedium className="h-3 w-3" />;`,
      errors: 1,
    },
    {
      name: 'flags a size class inside cn()',
      code: `${iconImport} <IconPlusMedium className={cn('size-3.5', active && 'text-accent')} />;`,
      errors: 1,
    },
    {
      name: 'flags a responsive size class',
      code: `${iconImport} <IconPlusMedium className="md:size-5" />;`,
      errors: 1,
    },
    {
      name: 'flags a product icon from an icons folder',
      code: 'import { WorkflowIcon } from \'@/ds/icons/WorkflowIcon\'; <WorkflowIcon className="size-4" />;',
      errors: 1,
    },
  ],
});
