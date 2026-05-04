import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Animations } from './animations';
import { BorderRadius } from './borders';
import { Colors, BorderColors } from './colors';
import { FontSizes, LineHeights } from './fonts';
import { Shadows, Glows } from './shadows';
import { Spacings } from './spacings';

const meta: Meta = {
  title: 'Foundations/Tokens',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'All design tokens available in `packages/playground-ui`. Sourced from `src/ds/tokens/*.ts` and mirrored in the Tailwind v4 `@theme` block of `src/index.css`. Use these tokens through their Tailwind utility classes (e.g. `text-ui-lg`, `bg-surface2`, `p-4`) rather than raw CSS values.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

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
        const isHeader = token.startsWith('header');
        const variant = token as keyof typeof FontSizes;
        return (
          <Row
            key={token}
            name={token}
            meta={
              <>
                {size} / {LineHeights[token as keyof typeof LineHeights]}
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

export const ColorsStory: Story = {
  name: 'Colors',
  render: () => {
    const all = Object.entries(Colors);
    const groups: Record<string, [string, string][]> = {
      Surface: all.filter(([k]) => k.startsWith('surface')),
      Neutral: all.filter(([k]) => k.startsWith('neutral')),
      Accent: all.filter(([k]) => k.startsWith('accent')),
      Semantic: all.filter(([k]) => ['error', 'overlay'].includes(k)),
      Border: Object.entries(BorderColors),
    };
    return (
      <div>
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
