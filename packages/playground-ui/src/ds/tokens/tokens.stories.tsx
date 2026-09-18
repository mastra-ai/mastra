import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Animations } from './animations';
import { BorderRadius } from './borders';
import { Colors, BorderColors } from './colors';
import { FontSizes, LineHeights } from './fonts';
import { Shadows, Glows } from './shadows';
import { Spacings } from './spacings';
import { cn } from '@/lib/utils';

const meta: Meta = {
  title: 'Foundations/Tokens',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Design tokens available in `packages/playground-ui`. Foundation tokens live in `theme.css`; opt-in semantic tokens live in `new-theme.css` under `.new-theme`; TypeScript mirrors the component-facing tokens in `src/ds/tokens`. Components use semantic color roles rather than foundation values.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const isFontVariant = (token: string): token is keyof typeof FontSizes => token in FontSizes;
const isLineHeight = (token: string): token is keyof typeof LineHeights => token in LineHeights;

const Row = ({ name, meta, preview }: { name: string; meta: React.ReactNode; preview: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '220px 140px 1fr',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.75rem 0',
      borderBottom: `1px solid var(--border1)`,
    }}
  >
    <Txt variant="ui-sm" font="mono">
      {name}
    </Txt>
    <Txt variant="ui-sm" font="mono">
      <span style={{ color: 'var(--neutral3)' }}>{meta}</span>
    </Txt>
    <div>{preview}</div>
  </div>
);

const SectionTitle = ({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) => (
  <div style={{ marginTop: '2.5rem', marginBottom: '0.5rem' }}>
    <Txt as="h2" variant="header-md">
      {children}
    </Txt>
    {note && (
      <Txt variant="ui-sm">
        <span style={{ color: 'var(--neutral3)' }}>{note}</span>
      </Txt>
    )}
  </div>
);

export const Typography: Story = {
  render: () => (
    <div>
      <SectionTitle note="Tailwind classes: text-{token} and leading-{token}. Use the Txt component with the variant prop.">
        Typography
      </SectionTitle>
      {Object.entries(FontSizes).map(([token, size]) => {
        if (!isFontVariant(token) || !isLineHeight(token)) return null;
        const isHeader = token.startsWith('header');
        const variant = token;
        const lineHeight = LineHeights[token];
        return (
          <Row
            key={token}
            name={token}
            meta={
              <>
                {size} / {lineHeight}
              </>
            }
            preview={
              <Txt as={isHeader ? 'h3' : 'p'} variant={variant}>
                The quick brown fox jumps over the lazy dog
              </Txt>
            }
          />
        );
      })}
    </div>
  ),
};

const Swatch = ({ token, value }: { token: string; value: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
    <div
      style={{
        width: '100%',
        height: '56px',
        background: value,
        border: `1px solid var(--border1)`,
        borderRadius: 'var(--radius-md)',
      }}
    />
    <Txt variant="ui-sm" font="mono">
      {token}
    </Txt>
  </div>
);

const SwatchGrid = ({ entries }: { entries: [string, string][] }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '1rem',
    }}
  >
    {entries.map(([token, value]) => (
      <Swatch key={token} token={token} value={value} />
    ))}
  </div>
);

const semanticEntries: [string, string][] = [
  ['background', Colors.background],
  ['sidebar', Colors.sidebar],
  ['card', Colors.card],
  ['popover', Colors.popover],
  ['muted', Colors.muted],
  ['foreground', Colors.foreground],
  ['muted-foreground', Colors['muted-foreground']],
  ['ring', Colors.ring],
  ['sidebar-accent', Colors['sidebar-accent']],
  ['selected', Colors.selected],
];

// The one chromatic pair in the contract. Both themes share the same red so a white
// glyph or label on the filled surface clears WCAG AA at 4.77:1.
const semanticChromaticEntries: [string, string][] = [
  ['destructive', Colors.destructive],
  ['destructive-foreground', Colors['destructive-foreground']],
];

const semanticBorderEntries: [string, string][] = [
  ['border', BorderColors.border],
  ['sidebar-divider', BorderColors['sidebar-divider']],
];

const SurfacePreview = ({ semantic }: { semantic: boolean }) => {
  return (
    <div
      className={cn(
        'grid min-h-80 grid-cols-[9rem_1fr] overflow-hidden rounded-lg border',
        semantic ? 'new-theme border-border text-foreground' : 'border-border1 text-neutral6',
      )}
    >
      <div className={cn('p-4', semantic ? 'bg-sidebar' : 'bg-surface1')}>
        <Txt variant="ui-sm">Sidebar</Txt>
        <div className="mt-4 space-y-2">
          <div className={cn('h-6 rounded', semantic ? 'bg-sidebar-accent' : 'bg-sidebar-nav-hover')} />
          <div className={cn('h-6 rounded', semantic ? 'bg-selected' : 'bg-sidebar-nav-active')} />
        </div>
      </div>
      <div className={cn('relative p-4', semantic ? 'bg-background' : 'bg-surface2')}>
        <Txt variant="ui-sm">Main canvas</Txt>
        <div
          className={cn(
            'mt-4 rounded-lg border p-4',
            semantic ? 'border-border bg-card' : 'border-border1 bg-surface3',
          )}
        >
          <Txt variant="ui-sm">Card</Txt>
          <div className={cn('mt-3 rounded-md p-3', semantic ? 'bg-muted' : 'bg-surface4')}>
            <Txt variant="ui-sm">Muted region</Txt>
          </div>
        </div>
        <div
          className={cn(
            'absolute right-6 bottom-6 w-36 rounded-md border p-3 shadow-lg',
            semantic ? 'border-border bg-popover' : 'border-border1 bg-surface3',
          )}
        >
          <Txt variant="ui-sm">Popover</Txt>
        </div>
      </div>
    </div>
  );
};

export const SurfaceMigration: Story = {
  render: () => (
    <div>
      <SectionTitle note="This compares the current numbered surface hierarchy with the planned semantic roles. It is not a global token replacement table.">
        Surface migration
      </SectionTitle>
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <Txt as="h3" variant="header-sm">
            Current: surface1–4
          </Txt>
          <div className="mt-3">
            <SurfacePreview semantic={false} />
          </div>
        </div>
        <div>
          <Txt as="h3" variant="header-sm">
            Proposed: semantic roles
          </Txt>
          <div className="mt-3">
            <SurfacePreview semantic />
          </div>
        </div>
      </div>
      <div className="text-ui-sm mt-6 grid gap-2 md:grid-cols-2">
        <div className="font-mono">surface1 → sidebar</div>
        <div className="font-mono">surface2 → background</div>
        <div className="font-mono">surface3 → card / popover</div>
        <div className="font-mono">surface4 → muted</div>
      </div>
    </div>
  ),
};

export const SemanticNeutrals: Story = {
  render: () => (
    <div className="new-theme">
      <SectionTitle note="Apply new-theme to the component or portal root. Use semantic Tailwind utilities such as bg-card and text-muted-foreground.">
        Semantic neutrals
      </SectionTitle>
      <SwatchGrid entries={[...semanticEntries, ...semanticBorderEntries]} />
      <SectionTitle note="The only chromatic roles in the contract. Pair them: a glyph or label on `destructive` uses `destructive-foreground`, which clears WCAG AA at 4.77:1.">
        Semantic destructive
      </SectionTitle>
      <SwatchGrid entries={semanticChromaticEntries} />
      <div className="mb-6 flex items-center gap-3">
        <span className="bg-destructive text-ui-sm text-destructive-foreground inline-flex rounded-full px-3 py-1 font-medium">
          Delete thread
        </span>
        <span className="text-ui-sm text-destructive">Delete thread</span>
      </div>
      <SectionTitle note="Use these combinations after a consumer opts into the semantic layer.">
        Representative combinations
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border-border bg-background text-foreground rounded-md border p-4">
          <div className="text-ui-sm font-medium">Observation summary</div>
          <div className="text-ui-sm text-muted-foreground mt-1">Today, 12 minutes ago</div>
          <div className="bg-muted text-ui-xs text-muted-foreground mt-3 inline-flex rounded px-2 py-1">
            Thread support-triage
          </div>
        </div>
        <div className="border-border bg-muted rounded-md border p-4">
          <div className="text-ui-sm text-foreground font-medium">Dataset import</div>
          <div className="text-ui-sm text-muted-foreground mt-1">No validation issues found.</div>
        </div>
      </div>
    </div>
  ),
};

export const ColorsStory: Story = {
  name: 'Colors',
  render: () => {
    const all = Object.entries(Colors);
    const groups = {
      Surface: all.filter(([k]) => k.startsWith('surface')),
      Neutral: all.filter(([k]) => k.startsWith('neutral')),
      Accent: all.filter(([k]) => k.startsWith('accent')),
      Semantic: all.filter(([k]) => ['error', 'overlay'].includes(k)),
      Border: Object.entries(BorderColors),
    };
    return (
      <div className="new-theme">
        <SectionTitle note="Tailwind classes: bg-{token}, text-{token}, border-{token}. Values are CSS vars, so light/dark themes swap automatically.">
          Colors
        </SectionTitle>
        {Object.entries(groups).map(([group, entries]) => (
          <div key={group} style={{ marginBottom: '2rem' }}>
            <Txt as="h3" variant="header-sm">
              {group}
            </Txt>
            <div style={{ marginTop: '0.75rem' }}>
              <SwatchGrid entries={entries} />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

export const Spacing: Story = {
  render: () => (
    <div>
      <SectionTitle note="Tailwind: p-{token}, m-{token}, gap-{token}, space-x-{token}, etc. Values match Tailwind defaults but the scale is restricted to these steps — arbitrary multipliers like p-13 are disabled.">
        Spacing
      </SectionTitle>
      {Object.entries(Spacings).map(([token, value]) => (
        <Row
          key={token}
          name={`spacing-${token}`}
          meta={value}
          preview={
            <div
              style={{
                width: value,
                height: '12px',
                background: 'var(--accent3)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          }
        />
      ))}
    </div>
  ),
};

export const Radius: Story = {
  render: () => (
    <div>
      <SectionTitle note="Tailwind: rounded-{token}.">Border Radius</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '1rem',
        }}
      >
        {Object.entries(BorderRadius).map(([token, value]) => (
          <div key={token} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              style={{
                width: '100%',
                height: '80px',
                background: 'var(--surface3)',
                border: `1px solid var(--border1)`,
                borderRadius: value,
              }}
            />
            <Txt variant="ui-sm" font="mono">
              {token} — {value}
            </Txt>
          </div>
        ))}
      </div>
    </div>
  ),
};

const ShadowBox = ({ token, value }: { token: string; value: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <div
      style={{
        width: '100%',
        height: '80px',
        background: 'var(--surface2)',
        border: `1px solid var(--border1)`,
        borderRadius: 'var(--radius-md)',
        boxShadow: value,
      }}
    />
    <Txt variant="ui-sm" font="mono">
      {token}
    </Txt>
  </div>
);

export const ShadowsStory: Story = {
  name: 'Shadows',
  render: () => (
    <div>
      <SectionTitle note="Tailwind: shadow-{token}. Glows are used for focus rings and interactive emphasis.">
        Shadows &amp; Glows
      </SectionTitle>
      <Txt as="h3" variant="header-sm">
        Shadows
      </Txt>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '1.5rem',
          margin: '0.75rem 0 2rem',
        }}
      >
        {Object.entries(Shadows).map(([token, value]) => (
          <ShadowBox key={token} token={token} value={value} />
        ))}
      </div>
      <Txt as="h3" variant="header-sm">
        Glows
      </Txt>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '1.5rem',
          marginTop: '0.75rem',
        }}
      >
        {Object.entries(Glows).map(([token, value]) => (
          <ShadowBox key={token} token={token} value={value} />
        ))}
      </div>
    </div>
  ),
};

export const AnimationTokens: Story = {
  name: 'Animations',
  render: () => (
    <div>
      <SectionTitle note="Tailwind: duration-{normal|slow}, ease-out-custom.">Animations</SectionTitle>
      {Object.entries(Animations).map(([token, value]) => (
        <Row key={token} name={token} meta={value} preview={<Txt variant="ui-sm">{value}</Txt>} />
      ))}
    </div>
  ),
};
