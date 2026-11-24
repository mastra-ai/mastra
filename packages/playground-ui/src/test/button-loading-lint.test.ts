import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import plugin from '../../oxlint/index.js';

RuleTester.describe = (name, run) => {
  if (name === 'valid') return describe('when a button shows loading through its loading prop', run);
  if (name === 'invalid') return describe('when a button shows loading another way', run);
  return describe(name, run);
};
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } });
const imports = "import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';";
const jsx = (code: string, before = '') => `${imports} ${before} const view = ${code};`;
const loader = (name = 'Button') => ({
  message: `Show loading with <${name}>'s \`loading\` prop, not a loader inside it.`,
});
const label = (name = 'Button') => ({
  message: `Keep <${name}>'s label the same while it loads: \`loading\` already shows it.`,
});

tester.run('button-loading', plugin.rules['button-loading'], {
  valid: [
    { name: 'allows a label that stays', code: jsx('<Button loading={save.isPending}>Save</Button>') },
    {
      name: 'allows a label that changes with other state',
      code: jsx("<Button loading={save.isPending}>{editing ? 'Save' : 'Create'}</Button>"),
    },
    {
      name: 'allows a label from another member of the same object',
      code: jsx("<Button loading={save.isPending}>{save.isError ? 'Try again' : 'Save'}</Button>"),
    },
    {
      name: 'allows a label that changes without loading',
      code: jsx("<Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>"),
    },
    {
      name: 'allows a label that changes with one side of an && that loading gets',
      code: jsx("<Button loading={open && refreshing}>{open ? 'Close' : 'Open'}</Button>"),
    },
    {
      name: 'allows a finished label that waits for loading to end',
      code: jsx("<Button loading={saving}>{!saving && saved ? 'Saved' : 'Save'}</Button>"),
    },
    {
      name: 'allows a finished label that waits for a negated loading to end',
      code: jsx("<Button loading={!ready}>{ready && saved ? 'Saved' : 'Save'}</Button>"),
    },
    { name: 'allows a button that always loads', code: jsx('<Button loading>{busy ? "Saving" : "Save"}</Button>') },
    {
      name: 'allows branches that render the same',
      code: jsx("<Button loading={saving}>{saving ? 'Save' : 'Save'}</Button>"),
    },
    {
      name: 'allows a class inside the label to change',
      code: jsx("<Button loading={saving}><span className={saving ? 'a' : 'b'}>Save</span></Button>"),
    },
    {
      name: 'allows a callback inside the label',
      code: jsx("<Button loading={saving}>{items.map(item => (saving ? 'Saving' : item))}</Button>"),
    },
    {
      name: 'allows an icon that changes, which is not a label',
      code: jsx('<Button loading={saving} icon={saving ? <IconStop /> : <IconPlusMedium />}>Save</Button>'),
    },
    {
      name: 'allows a glyph that changes in an icon button',
      code: jsx('<Button size="icon-sm" loading={saving}>{saving ? <IconStop /> : <IconPlusMedium />}</Button>'),
    },
    {
      name: 'allows a tooltip that changes beside a label',
      code: jsx("<Button loading={saving} tooltip={saving ? 'Wait for it to finish' : undefined}>Save</Button>"),
    },
    {
      name: 'allows a tooltip that changes when an aria-label names the button',
      code: jsx(
        '<Button size="icon-sm" loading={saving} aria-label="Save" tooltip={saving ? "Saving…" : "Save"}><IconPlusMedium /></Button>',
      ),
    },
    {
      name: 'allows a label from a destructured value or a parameter',
      code: jsx('<Button loading={saving}>{label}</Button>', 'const { label } = copy;'),
    },
    {
      name: 'allows a reassignable label',
      code: jsx('<Button loading={saving}>{label}</Button>', "let label = saving ? 'Saving…' : 'Save';"),
    },
    { name: 'allows a loader beside the button', code: jsx('<div><Spinner /><Button>Save</Button></div>') },
    {
      name: 'allows a loader in a prop that is not rendered in the button',
      code: jsx('<Button render={<Link icon={<Spinner />} />}>Save</Button>'),
    },
    {
      name: 'allows a DialogAction whose Dialog is pending on something else',
      code: jsx("<Dialog pending={saving}><DialogAction>{editing ? 'Save' : 'Create'}</DialogAction></Dialog>"),
    },
    {
      name: "leaves a Dialog's pending to the DialogAction without its own loading",
      code: jsx(
        "<Dialog pending={busy}><DialogAction loading={saving}>{busy ? 'Working' : 'Save'}</DialogAction></Dialog>",
      ),
    },
    {
      name: 'ignores other components',
      code: jsx("<DropdownMenu.Item loading={saving}><Spinner /> {saving ? 'Saving…' : 'Save'}</DropdownMenu.Item>"),
    },
    {
      name: 'checks only the components it is given',
      code: jsx('<Button><Spinner /> Save</Button>'),
      options: [{ components: ['LinkButton'] }],
    },
  ],
  invalid: [
    { name: 'flags a Spinner child', code: jsx('<Button><Spinner /> Save</Button>'), errors: [loader()] },
    {
      name: 'flags a Spinner in icon and iconEnd',
      code: jsx('<Button icon={<Spinner />} iconEnd={busy && <Spinner />}>Save</Button>'),
      errors: [loader(), loader()],
    },
    {
      name: 'flags a Spinner in an icon slot chosen by a condition',
      code: jsx('<Button icon={busy ? <Spinner size="sm" /> : <IconPlusMedium />}>Save</Button>'),
      errors: [loader()],
    },
    {
      name: 'flags a Spinner in wrappers',
      code: jsx('<Button><><span><Spinner /></span> Save</></Button>'),
      errors: [loader()],
    },
    {
      name: 'flags a Spinner from a constant',
      code: jsx('<Button icon={icon}>Save</Button>', 'const icon = busy ? <Spinner /> : <IconPlusMedium />;'),
      errors: [loader()],
    },
    {
      name: 'flags an icon that spins',
      code: jsx('<Button icon={<IconLoadingCircle className="motion-safe:animate-spin" />}>Save</Button>'),
      errors: [loader()],
    },
    {
      name: 'flags an icon that spins on a condition',
      code: jsx("<Button><IconRefresh className={cn('size-4', busy && 'animate-spin')} /></Button>"),
      errors: [loader()],
    },
    {
      name: 'flags a loader beside loading',
      code: jsx('<Button loading={busy} icon={<Spinner />}>Save</Button>'),
      errors: [loader()],
    },
    {
      name: 'flags a label that changes with loading',
      code: jsx("<Button loading={saving}>{saving ? 'Saving…' : 'Save'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags the same member expression, optional or not',
      code: jsx("<Button loading={save?.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags the same comparison, negated',
      code: jsx("<Button loading={state === 'saving'}>{state !== 'saving' ? 'Save' : 'Saving…'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags a negation',
      code: jsx("<Button loading={saving}>{!saving ? 'Save' : 'Saving…'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags the opposite of a negated loading',
      code: jsx("<Button loading={!ready}>{ready ? 'Save' : 'Waiting…'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags the opposite of a compared loading',
      code: jsx("<Button loading={state !== 'ready'}>{state === 'ready' ? 'Save' : 'Waiting…'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags children in an array',
      code: jsx("<Button loading={saving}>{[saving ? 'Saving…' : 'Save', <Spinner key=\"spinner\" />]}</Button>"),
      errors: [label(), loader()],
    },
    {
      name: 'flags loading made a boolean',
      code: jsx("<Button loading={Boolean(saving)}>{!!saving ? 'Saving…' : 'Save'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags text rendered on a condition',
      code: jsx("<Button loading={saving}>Save{saving && '…'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags a template string',
      code: jsx("<Button loading={saving}>{`${saving ? 'Saving' : 'Save'} ${name}`}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags text joined with +',
      code: jsx("<Button loading={saving}>{(saving ? 'Saving ' : 'Save ') + name}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags labels from variables',
      code: jsx('<Button loading={saving}>{saving ? pendingLabel : label}</Button>'),
      errors: [label()],
    },
    {
      name: 'flags a label in an element',
      code: jsx('<Button loading={saving}>{saving ? <span>Saving…</span> : <span>Save</span>}</Button>'),
      errors: [label()],
    },
    {
      name: 'flags a nested condition',
      code: jsx("<Button loading={saving}>{saving ? 'Saving…' : editing ? 'Save' : 'Create'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags the other way around',
      code: jsx("<Button loading={saving}>{editing ? (saving ? 'Saving…' : 'Save') : 'Create'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags one side of an || that loading gets',
      code: jsx("<Button loading={saving || refreshing}>{saving ? 'Saving…' : 'Save'}</Button>"),
      errors: [label()],
    },
    {
      name: 'flags a test that holds with loading and something else',
      code: jsx("<Button loading={saving}>{saving || done ? 'Saved' : 'Save'}{saving && draft && '…'}</Button>"),
      errors: [label(), label()],
    },
    {
      name: 'flags a label from a constant',
      code: jsx('<Button loading={saving}>{label}</Button>', "const label = saving ? 'Saving…' : 'Save';"),
      errors: [label()],
    },
    {
      name: 'flags a state behind a constant',
      code: jsx(
        "<Button loading={busy}>{save.isPending ? 'Saving…' : 'Save'}</Button>",
        'const busy = save.isPending || load.isPending;',
      ),
      errors: [label()],
    },
    {
      name: 'flags an aria-label',
      code: jsx('<Button loading={saving} aria-label={saving ? "Saving" : "Save"}><IconPlusMedium /></Button>'),
      errors: [label()],
    },
    {
      name: 'flags the tooltip that names an icon button',
      code: jsx(
        '<Button size="icon-sm" loading={saving} tooltip={saving ? "Saving" : "Save"}><IconPlusMedium /></Button>',
      ),
      errors: [label()],
    },
    {
      name: 'flags the children prop',
      code: jsx("<Button loading={saving} children={saving ? 'Saving…' : 'Save'} />"),
      errors: [label()],
    },
    {
      name: 'flags a Spinner in the children prop',
      code: jsx('<Button children={<Spinner />} />'),
      errors: [loader()],
    },
    {
      name: "flags a DialogAction that changes with its Dialog's pending",
      code: jsx("<Dialog pending={saving}><DialogAction>{saving ? 'Saving…' : 'Save'}</DialogAction></Dialog>"),
      errors: [label('DialogAction')],
    },
    {
      name: 'flags a loader and the label beside it',
      code: jsx("<Button loading={saving}>{saving ? <><Spinner /> Saving…</> : 'Save'}</Button>"),
      errors: [label(), loader()],
    },
    {
      name: 'flags the buttons that take the same prop',
      code: jsx(
        '<><AlertDialog.Action><Spinner /></AlertDialog.Action><Notice.Button><Spinner /> Retry</Notice.Button></>',
      ),
      errors: [loader('AlertDialog.Action'), loader('Notice.Button')],
    },
  ],
});
