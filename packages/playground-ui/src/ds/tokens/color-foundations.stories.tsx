import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';

const meta: Meta = {
  title: 'Foundations/Updated/Color',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Background tokens describe structural nesting. Gray tokens describe contrast strength, so the same gray step works in light and dark themes even though the tonal direction reverses.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const backgrounds = [
  { token: 'background-1', role: 'Sidebar' },
  { token: 'background-2', role: 'Canvas' },
  { token: 'background-3', role: 'Panel' },
];

const grayTokens = Array.from({ length: 10 }, (_, index) => `gray-${index + 1}`);
const grayAlphaTokens = Array.from({ length: 10 }, (_, index) => `gray-alpha-${index + 1}`);

const TokenName = ({ children }: { children: React.ReactNode }) => (
  <Txt variant="ui-sm" font="mono" className="truncate">
    {children}
  </Txt>
);

const BackgroundSwatch = ({ token, role }: { token: string; role: string }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div
      aria-label={`${token} color swatch`}
      role="img"
      className="h-24 border border-border1"
      style={{ borderRadius: 'var(--radius-md)', background: `var(--${token})` }}
    />
    <div className="flex min-w-0 items-start justify-between gap-2">
      <TokenName>{token}</TokenName>
      <Txt variant="ui-sm" className="shrink-0 text-neutral3">
        {role}
      </Txt>
    </div>
  </div>
);

const ScaleSwatch = ({ token, step }: { token: string; step: number }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div
      aria-label={`${token} color swatch`}
      role="img"
      className="h-16 border border-border1"
      style={{ borderRadius: 'var(--radius-md)', background: `var(--${token})` }}
    />
    <Txt variant="ui-xs" font="mono" className="text-neutral3">
      {step}
    </Txt>
  </div>
);

const ScaleRow = ({ label, description, tokens }: { label: string; description: string; tokens: string[] }) => (
  <section className="flex flex-col gap-4 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-6">
    <div className="flex flex-col gap-1">
      <Txt as="h2" variant="header-xs" className="font-medium">
        {label}
      </Txt>
      <Txt variant="ui-sm" className="text-neutral3">
        {description}
      </Txt>
    </div>
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {tokens.map((token, index) => (
          <ScaleSwatch key={token} token={token} step={index + 1} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
          Subtle
        </Txt>
        <div className="h-px flex-1 bg-border1" />
        <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
          Strong
        </Txt>
      </div>
    </div>
  </section>
);

export const ColorFoundations: Story = {
  name: 'Color foundations',
  render: (_args, context) => {
    const activeTheme = context.globals.backgrounds?.value === 'light' ? 'Light' : 'Dark';

    return (
      <div
        className="max-w-320 flex flex-col gap-8 border border-border1 p-5 sm:p-8"
        style={{ borderRadius: 'var(--radius-xl)', background: 'var(--background-2)' }}
      >
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="max-w-180 flex flex-col gap-2">
            <Txt as="h1" variant="header-lg" className="font-semibold">
              Color foundations
            </Txt>
            <Txt variant="ui-md" className="text-neutral4">
              Backgrounds encode nesting. Gray encodes contrast. The same gray step works across themes.
            </Txt>
          </div>
          <div className="rounded-full border border-border1 px-3 py-1.5" style={{ background: 'var(--background-3)' }}>
            <Txt variant="ui-xs" font="mono" className="text-neutral4 uppercase">
              {activeTheme}
            </Txt>
          </div>
        </header>

        <section className="flex flex-col gap-4 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-6">
          <div className="flex flex-col gap-1">
            <Txt as="h2" variant="header-xs" className="font-medium">
              Backgrounds
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3">
              Outer to inner
            </Txt>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {backgrounds.map(background => (
              <BackgroundSwatch key={background.token} token={background.token} role={background.role} />
            ))}
          </div>
        </section>

        <div className="h-px bg-border1" />

        <ScaleRow label="Gray" description="Contrast, not lightness" tokens={grayTokens} />

        <div className="h-px bg-border1" />

        <div className="rounded-lg p-4 sm:p-5" style={{ background: 'var(--background-1)' }}>
          <ScaleRow label="Gray alpha" description="Opacity and contrast" tokens={grayAlphaTokens} />
        </div>

        <footer className="flex flex-col gap-2 border-t border-border1 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Txt variant="ui-sm" className="text-neutral3">
            Background numbers follow product layers. Gray numbers increase contrast from 1 to 10.
          </Txt>
          <Txt variant="ui-sm" font="mono" className="shrink-0 text-neutral3">
            Raw CSS properties
          </Txt>
        </footer>
      </div>
    );
  },
};
