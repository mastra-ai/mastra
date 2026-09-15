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
  <section className="min-w-0">
    <div className="flex items-center justify-between gap-4 border-b border-border1 pb-3">
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
  <div className="flex min-h-28 min-w-0 flex-col justify-between gap-5 border-t border-border1 py-4">
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
    <div className="max-w-320 bg-surface2 px-5 sm:px-8">
      <header className="grid gap-5 border-y border-border1 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:py-8">
        <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
          Type system / 10 tokens
        </Txt>
        <div className="max-w-180 flex flex-col gap-2">
          <Txt as="h1" variant="header-lg" className="font-semibold">
            Typography foundations
          </Txt>
          <Txt variant="ui-md" className="text-neutral4">
            Font size and line height travel as one value. Txt is one component interface to the same scale.
          </Txt>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 py-8 xl:grid-cols-2 xl:gap-12">
        <TypeScale title="UI scale" tokens={uiTokens} />
        <TypeScale title="Heading scale" tokens={headingTokens} />
      </div>

      <section className="border-t border-border1 py-8">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <Txt as="h2" variant="header-sm" className="font-medium">
            Role map
          </Txt>
          <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
            Semantic hierarchy
          </Txt>
        </div>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
          <HierarchySpecimen role="Hero" token="header-xl" sample="Build agents that ship" />
          <HierarchySpecimen role="Page" token="header-md" sample="Agent overview" />
          <HierarchySpecimen role="Section" token="header-sm" sample="Recent activity" />
          <HierarchySpecimen role="Panel" token="ui-md" sample="Configuration" />
        </div>
      </section>

      <footer className="flex flex-col gap-1 border-t border-border1 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
        <Txt variant="ui-sm">Foundation: text-ui-* and text-header-*.</Txt>
        <Txt variant="ui-sm" className="text-neutral3">
          Txt applies these tokens through its variant prop.
        </Txt>
      </footer>
    </div>
  ),
};
