import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { FontSizes, LineHeights } from './fonts';

const meta: Meta = {
  title: 'Foundations/Typography foundations',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Mastra typography scale pairs every font size with its line height. Product copy uses Txt variants, and headings follow one hierarchy across surfaces.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type TypographyToken = keyof typeof FontSizes;

const uiTokens: TypographyToken[] = ['ui-xs', 'ui-sm', 'ui-smd', 'ui-md', 'ui-lg'];
const headingTokens: TypographyToken[] = ['header-xs', 'header-sm', 'header-md', 'header-lg', 'header-xl'];

const samples: Record<TypographyToken, string> = {
  'ui-xs': 'METADATA · 12:42 PM',
  'ui-sm': 'Secondary information and supporting labels',
  'ui-smd': 'Form field label',
  'ui-md': 'Default interface text',
  'ui-lg': 'Emphasized interface text',
  'header-xs': 'Compact heading',
  'header-sm': 'Section heading',
  'header-md': 'Page heading',
  'header-lg': 'Large heading',
  'header-xl': 'Hero heading',
};

const formatSize = (value: string) => `${Number.parseFloat(value) * 16}px`;

const formatLineHeight = (size: string, lineHeight: string) => {
  const pixels = Number.parseFloat(size) * 16;
  return `${Math.round((pixels * Number.parseFloat(lineHeight)) / 100)}px`;
};

const TypeRow = ({ token }: { token: TypographyToken }) => (
  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border1 py-3 last:border-b-0 sm:grid-cols-[6.5rem_4.5rem_minmax(0,1fr)] sm:gap-3">
    <Txt variant="ui-sm" font="mono" className="text-neutral3">
      {token}
    </Txt>
    <Txt variant="ui-xs" font="mono" className="text-neutral3 tabular-nums">
      {formatSize(FontSizes[token])} / {formatLineHeight(FontSizes[token], LineHeights[token])}
    </Txt>
    <Txt variant={token} className="col-span-2 min-w-0 sm:col-span-1 sm:truncate">
      {samples[token]}
    </Txt>
  </div>
);

const TypeScale = ({ title, tokens }: { title: string; tokens: TypographyToken[] }) => (
  <section className="min-w-0 rounded-lg border border-border1 px-4">
    <div className="flex items-center justify-between gap-4 border-b border-border1 py-4">
      <Txt as="h2" variant="header-sm" className="font-medium">
        {title}
      </Txt>
      <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
        Size / leading
      </Txt>
    </div>
    {tokens.map(token => (
      <TypeRow key={token} token={token} />
    ))}
  </section>
);

const HierarchySpecimen = ({ role, token, sample }: { role: string; token: TypographyToken; sample: string }) => (
  <div className="flex min-h-32 min-w-0 flex-col justify-between gap-5 rounded-lg border border-border1 bg-surface3 p-4">
    <div className="flex items-center justify-between gap-3">
      <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
        {role}
      </Txt>
      <Txt variant="ui-xs" font="mono" className="text-neutral3">
        {token}
      </Txt>
    </div>
    <Txt variant={token} className="font-medium text-balance">
      {sample}
    </Txt>
  </div>
);

export const TypographyFoundations: Story = {
  name: 'Typography foundations',
  render: () => (
    <div className="max-w-320 flex flex-col gap-8 rounded-xl border border-border1 bg-surface2 p-5 sm:p-8">
      <header className="max-w-180 flex flex-col gap-2">
        <Txt as="h1" variant="header-lg" className="font-semibold">
          Typography foundations
        </Txt>
        <Txt variant="ui-md" className="text-neutral4">
          Each token owns its font size and line height. Choose a semantic level, then keep the pair intact.
        </Txt>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TypeScale title="UI scale" tokens={uiTokens} />
        <TypeScale title="Heading scale" tokens={headingTokens} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Txt as="h2" variant="header-sm" className="font-medium">
            Heading hierarchy
          </Txt>
          <Txt variant="ui-sm" className="text-neutral3">
            The role selects the token. Element choice still follows document structure.
          </Txt>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HierarchySpecimen role="Hero" token="header-xl" sample="Build agents that ship" />
          <HierarchySpecimen role="Page" token="header-md" sample="Agent overview" />
          <HierarchySpecimen role="Section" token="header-sm" sample="Recent activity" />
          <HierarchySpecimen role="Panel" token="ui-md" sample="Configuration" />
        </div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-border1 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Txt variant="ui-sm" className="text-neutral3">
          Use Txt variants for product copy. Do not add a separate leading utility.
        </Txt>
        <Txt variant="ui-sm" font="mono" className="shrink-0 text-neutral3">
          10 paired tokens
        </Txt>
      </footer>
    </div>
  ),
};
