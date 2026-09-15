import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { FontSizes, LineHeights } from './fonts';

const meta: Meta = {
  title: 'Foundations/Updated/Typography',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The foundation pairs every font size with its line height. Txt is a convenience component that consumes this scale, not a separate typography system.',
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
          Ten tokens define font size and line height. Txt consumes this scale; it does not define another one.
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

      <footer className="grid gap-3 border-t border-border1 pt-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
            Foundation
          </Txt>
          <Txt variant="ui-sm">text-ui-* and text-header-* pair size with leading.</Txt>
        </div>
        <div className="flex flex-col gap-1">
          <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
            Component API
          </Txt>
          <Txt variant="ui-sm">Txt applies a foundation token through its variant prop.</Txt>
        </div>
      </footer>
    </div>
  ),
};
