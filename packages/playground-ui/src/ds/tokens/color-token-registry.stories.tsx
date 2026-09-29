import type { Meta, StoryObj } from '@storybook/react-vite';
import { colorFoundationTokens } from './color-foundations-catalog';
import { FoundationPage, FoundationSection, Specimen } from './foundations-layout';

const meta = {
  title: 'Foundations/Color',
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const registryGroups = [
  'Background and gray',
  'Chromatic ramps',
  'Status and badges',
  'Products',
  'Charts and spans',
  'Brand',
  'Surfaces, text, and boundaries',
] as const;

const registryGroupFor = (token: string) => {
  if (/^(background-[1-3]|gray-(?:alpha-)?\d+)$/.test(token)) return 'Background and gray';
  if (/^(red|orange|yellow|green|cyan|blue|purple|pink)-/.test(token)) return 'Chromatic ramps';
  if (/^(destructive|warning|success|info|badge)-/.test(token)) return 'Status and badges';
  if (token.startsWith('product-')) return 'Products';
  if (/^(chart|span)-/.test(token)) return 'Charts and spans';
  if (token.startsWith('color-brand-')) return 'Brand';
  return 'Surfaces, text, and boundaries';
};

export const TokenRegistry: Story = {
  name: 'Token registry',
  render: () => (
    <FoundationPage
      eyebrow={`Color / ${colorFoundationTokens.length} variables`}
      title="Token registry"
      description="Every shared color value and role, shown once without Tailwind aliases or shadow recipes. This lists available tokens; it does not indicate which ones Factory or Playground currently use."
    >
      {registryGroups.map(group => {
        const tokens = colorFoundationTokens.filter(token => registryGroupFor(token) === group);

        return (
          <FoundationSection key={group} label={group} description={`${tokens.length} variables`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {tokens.map(token => (
                <Specimen key={token} name={`--${token}`}>
                  <div
                    role="img"
                    aria-label={`--${token} swatch`}
                    className="h-16 border border-border"
                    style={{ background: `var(--${token})` }}
                  />
                </Specimen>
              ))}
            </div>
          </FoundationSection>
        );
      })}
    </FoundationPage>
  ),
};
