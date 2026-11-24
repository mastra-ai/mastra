import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a button takes its icon through a prop or has none', run);
  if (name === 'invalid') return describe('when an icon sits beside the label as a child', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });
const imports = "import { IconPlusMedium, Trash2 } from '@mastra/playground-ui/icons/central/IconPlusMedium';";
const jsx = (code: string) => `${imports} const view = ${code};`;
const error = (prop: string, name = 'Button') => ({
  message: `Pass this icon through <${name}>'s \`${prop}\` prop, not as a child beside the label.`,
});

tester.run('button-icon-prop', plugin.rules['button-icon-prop'], {
  valid: [
    {
      name: 'allows an icon beside children that render nothing',
      code: jsx('<Button><IconPlusMedium />{null}{false}{undefined}</Button>'),
    },
    {
      name: 'allows a button whose spread may replace its size',
      code: jsx('<Button size="sm" {...props}><IconPlusMedium /> Add</Button>'),
    },
    {
      name: 'allows a button whose spread may carry the size',
      code: jsx('<Button {...props}><IconPlusMedium /> Add</Button>'),
    },
    { name: 'allows the icon props', code: jsx('<Button icon={<IconPlusMedium />} iconEnd={<Trash2 />}>Add</Button>') },
    { name: 'allows a label alone', code: jsx('<Button>Add</Button>') },
    { name: 'allows an icon-only button', code: jsx('<Button size="icon-md"><IconPlusMedium /></Button>') },
    { name: 'leaves an icon with no label to icon-button-size', code: jsx('<Button><IconPlusMedium /></Button>') },
    {
      name: 'allows an icon-only button with a hidden label',
      code: jsx('<Button size="icon-sm"><IconPlusMedium /><span className="sr-only">Add</span></Button>'),
    },
    {
      name: 'allows an icon-only button whose glyph depends on state',
      code: jsx('<Button>{busy ? <Spinner /> : <IconPlusMedium />}</Button>'),
    },
    {
      name: 'allows a forwarded size, which may be an icon size',
      code: jsx('<Button size={size}><IconPlusMedium /> Add</Button>'),
    },
    {
      name: 'allows a size that may be an icon size',
      code: jsx("<Button size={compact ? 'icon-sm' : 'sm'}><IconPlusMedium /> {label}</Button>"),
    },
    { name: 'allows an avatar beside the label', code: jsx('<Button><Avatar name="Ada" /> Ada</Button>') },
    { name: 'allows a badge after the label', code: jsx('<Button>Runs <Badge>3</Badge></Button>') },
    { name: 'allows a key hint after the label', code: jsx('<Button>Search <Kbd>K</Kbd></Button>') },
    {
      name: 'allows a count and text split by expressions',
      code: jsx('<Button>{count} selected {count === 1 ? "run" : "runs"}</Button>'),
    },
    {
      name: 'allows an icon between two parts of the label',
      code: jsx('<Button>From <IconPlusMedium /> to</Button>'),
    },
    {
      name: 'allows a condition that renders an icon or a label',
      code: jsx('<Button>{copied ? <IconPlusMedium /> : "Copy"}</Button>'),
    },
    {
      name: 'allows a leading child that is an icon or an avatar',
      code: jsx('<Button>{user ? <Avatar /> : <IconPlusMedium />} Account</Button>'),
    },
    {
      name: 'allows a wrapper that holds the icon and its label',
      code: jsx('<Button><span><IconPlusMedium /> Add</span></Button>'),
    },
    {
      name: 'allows a status dot beside the icon prop',
      code: jsx('<Button icon={<IconPlusMedium />}><StatusIcon /> Add</Button>'),
    },
    { name: 'ignores other components', code: jsx('<DropdownMenu.Item><IconPlusMedium /> Add</DropdownMenu.Item>') },
    {
      name: 'allows an icon after a Notice.Button label, which has no iconEnd',
      code: jsx('<Notice.Button>Retry <IconPlusMedium /></Notice.Button>'),
    },
    {
      name: 'checks only the components it is given',
      code: jsx('<Button><IconPlusMedium /> Add</Button>'),
      options: [{ components: { LinkButton: ['icon'] } }],
    },
  ],
  invalid: [
    { name: 'flags a leading icon', code: jsx('<Button><IconPlusMedium /> Add</Button>'), errors: [error('icon')] },
    { name: 'flags a trailing icon', code: jsx('<Button>Add <Trash2 /></Button>'), errors: [error('iconEnd')] },
    {
      name: 'flags both ends',
      code: jsx('<Button><Trash2 /> Add <IconPlusMedium /></Button>'),
      errors: [error('icon'), error('iconEnd')],
    },
    {
      name: 'flags the end its prop does not cover',
      code: jsx('<Button icon={<Trash2 />}>Add <IconPlusMedium /></Button>'),
      errors: [error('iconEnd')],
    },
    {
      name: 'flags an icon around a label from an expression',
      code: jsx('<Button><IconPlusMedium /> {label}</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon after explicit spaces',
      code: jsx("<Button>Continue{' '}<IconPlusMedium /></Button>"),
      errors: [error('iconEnd')],
    },
    {
      name: 'flags a text size chosen by a condition',
      code: jsx("<Button size={compact ? 'sm' : 'md'}><IconPlusMedium /> Add</Button>"),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon that renders on a condition',
      code: jsx('<Button>{busy && <Spinner />} Save</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon with an empty alternative',
      code: jsx('<Button>{busy ? <Spinner /> : null} Save</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags one of two icons',
      code: jsx('<Button>{busy ? <Spinner /> : <IconPlusMedium />} Save</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags icons in the branches of a condition, each with its label',
      code: jsx('<Button>{busy ? <><Spinner /> Saving</> : <><IconPlusMedium /> Save</>}</Button>'),
      errors: [error('icon'), error('icon')],
    },
    {
      name: 'flags an icon in one branch only',
      code: jsx("<Button>{busy ? <><Spinner /> Saving</> : 'Save'}</Button>"),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon in a fragment',
      code: jsx('<Button><><IconPlusMedium /> Add</></Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon from a variable or a prop',
      code: jsx('<Button>{icon} {label}</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon from an object',
      code: jsx('<Button>{entry?.icon}{entry.label}</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon component from an object',
      code: jsx('<Button><entry.icon /> {entry.label}</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags an icon in an Icon or span wrapper',
      code: jsx('<Button><Icon size="xs"><Trash2 /></Icon> <b>Delete</b> <span><IconPlusMedium /></span></Button>'),
      errors: [error('icon'), error('iconEnd')],
    },
    { name: 'flags a bare svg', code: jsx('<Button><svg /> Add</Button>'), errors: [error('icon')] },
    {
      name: 'flags a product icon by its name',
      code: jsx('<Button><ProviderBrandIcon provider="openai" /> OpenAI</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags a link rendered as a button',
      code: jsx('<Button render={<Link to="/" />}>Open <IconPlusMedium /></Button>'),
      errors: [error('iconEnd')],
    },
    {
      name: 'flags a button with a spread and a text size',
      code: jsx('<Button {...props} size="sm"><IconPlusMedium /> Add</Button>'),
      errors: [error('icon')],
    },
    {
      name: 'flags the buttons that take the same props',
      code: jsx(
        '<><DialogAction><IconPlusMedium /> Add</DialogAction><Notice.Button><Trash2 /> Clear</Notice.Button></>',
      ),
      errors: [error('icon', 'DialogAction'), error('icon', 'Notice.Button')],
    },
  ],
});
