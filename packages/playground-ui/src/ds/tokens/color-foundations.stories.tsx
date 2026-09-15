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

const BackgroundSwatch = ({ token, role }: { token: string; role: string }) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div
      aria-label={`${token} color swatch`}
      role="img"
      className="h-24 border border-border1"
      style={{ background: `var(--${token})` }}
    />
    <div className="flex min-w-0 items-start justify-between gap-2">
      <Txt variant="ui-sm" font="mono" className="truncate">
        {token}
      </Txt>
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
      style={{ background: `var(--${token})` }}
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
      <div className="max-w-320 px-5 sm:px-8" style={{ background: 'var(--background-2)' }}>
        <header className="grid gap-5 border-y border-border1 py-6 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:py-8">
          <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
            Neutrals / 23 tokens
          </Txt>
          <div className="max-w-180 flex flex-col gap-2">
            <Txt as="h1" variant="header-lg" className="font-semibold">
              Color foundations
            </Txt>
            <Txt variant="ui-md" className="text-neutral4">
              Backgrounds encode nesting. Gray encodes contrast. The same step keeps its role across themes.
            </Txt>
          </div>
          <Txt variant="ui-xs" font="mono" className="text-neutral3 uppercase">
            Mode / {activeTheme}
          </Txt>
        </header>

        <section className="flex flex-col gap-5 py-8 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-6">
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

        <section className="border-t border-border1 py-8">
          <ScaleRow label="Gray" description="Contrast, not lightness" tokens={grayTokens} />
        </section>

        <section
          className="-mx-5 border-y border-border1 px-5 py-8 sm:-mx-8 sm:px-8"
          style={{ background: 'var(--background-1)' }}
        >
          <ScaleRow label="Gray alpha" description="Opacity and contrast" tokens={grayAlphaTokens} />
        </section>

        <footer className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
          <Txt variant="ui-sm">Foundation CSS properties. No generated utilities.</Txt>
          <Txt variant="ui-sm" className="text-neutral3">
            Gray runs from subtle 1 to strong 10.
          </Txt>
        </footer>
      </div>
    );
  },
};
