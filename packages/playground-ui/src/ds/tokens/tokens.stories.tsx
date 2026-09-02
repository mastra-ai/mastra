import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Animations } from './animations';
import { BorderRadius } from './borders';
import { FoundationColors, LegacyColors, SemanticColors } from './color-variables';
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
          'All design tokens available in `packages/playground-ui`. Sourced from `src/ds/tokens/*.ts` and mirrored in the Tailwind v4 `@theme` block of `src/index.css`. Use these tokens through their Tailwind utility classes (e.g. `text-ui-lg`, `bg-surface-secondary`, `p-4`) rather than raw CSS values.',
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
      borderBottom: `1px solid var(--border-subtle)`,
    }}
  >
    <Txt variant="ui-sm" font="mono">
      {name}
    </Txt>
    <Txt variant="ui-sm" font="mono">
      <span style={{ color: 'var(--text-secondary)' }}>{meta}</span>
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
        <span style={{ color: 'var(--text-secondary)' }}>{note}</span>
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
        border: `1px solid var(--border-subtle)`,
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

const compatibilityAliases = {
  surface1: 'surface-primary',
  surface2: 'surface-secondary',
  surface3: 'surface-raised',
  surface4: 'surface-hover',
  surface5: 'surface-active',
  neutral1: 'text-disabled',
  neutral2: 'text-secondary',
  neutral3: 'text-secondary',
  neutral4: 'text-primary',
  neutral5: 'text-primary',
  neutral6: 'text-primary',
  border1: 'border-subtle',
  border2: 'border-default',
  accent1: 'green-7',
  accent2: 'red-7',
  accent3: 'blue-7',
  accent5: 'blue-8',
  accent6: 'orange-7',
  positive1: 'color-success',
  warning1: 'color-warning',
  negative1: 'color-error',
} as const;

export const ColorsStory: Story = {
  name: 'Colors',
  render: () => {
    const semantic = Object.entries(SemanticColors);
    const foundation = Object.entries(FoundationColors);
    const groups: Record<string, [string, string][]> = {
      Surfaces: semantic.filter(([key]) => key.startsWith('surface-')),
      Text: semantic.filter(([key]) => key.startsWith('text-')),
      Borders: semantic.filter(([key]) => key.startsWith('border-') || key === 'outline-image'),
      Status: semantic.filter(([key]) => key.startsWith('color-') || key.startsWith('fill-')),
      'Data visualization': semantic.filter(([key]) => key.startsWith('chart-')),
      'Gray foundation': foundation.filter(([key]) => key.startsWith('background-') || key.startsWith('gray-')),
      'Hue foundation': foundation.filter(([key]) => /^(green|orange|red|yellow|blue|pink|purple)-/.test(key)),
      'Component colors': Object.entries(LegacyColors).filter(
        ([key]) => key.startsWith('badge-') || key.startsWith('notice-') || key.startsWith('sidebar-'),
      ),
    };

    return (
      <div>
        <SectionTitle note="Choose semantic roles for component UI. Use foundation ramps for data visualization and component recipes that need several steps from one hue.">
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
        <SectionTitle note="These aliases keep existing consumers working. New code should use the replacement token.">
          Compatibility aliases
        </SectionTitle>
        {Object.entries(compatibilityAliases).map(([name, replacement]) => (
          <Row
            key={name}
            name={name}
            meta={`→ ${replacement}`}
            preview={<Swatch token={replacement} value={Colors[replacement as keyof typeof Colors]} />}
          />
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
                background: 'var(--blue-9)',
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
                background: 'var(--surface-raised)',
                border: `1px solid var(--border-subtle)`,
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
        background: 'var(--surface-secondary)',
        border: `1px solid var(--border-subtle)`,
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
