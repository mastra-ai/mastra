import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Colors } from './colors';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Color',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Background tokens describe structural nesting, gray tokens describe contrast strength, and the semantic tokens name the role a component asks for. Components reference roles; the ramps underneath them are the raw material.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type ColorToken = keyof typeof Colors;

const backgrounds = [
  { token: 'background-1', role: 'Sidebar' },
  { token: 'background-2', role: 'Canvas' },
  { token: 'background-3', role: 'Panel' },
];

const grayTokens = Array.from({ length: 10 }, (_, index) => `gray-${index + 1}`);
const grayAlphaTokens = Array.from({ length: 10 }, (_, index) => `gray-alpha-${index + 1}`);

const surfaceRoles: { token: ColorToken; note: string }[] = [
  { token: 'background', note: 'The canvas every page sits on' },
  { token: 'sidebar', note: 'App chrome, one step behind the canvas' },
  { token: 'card', note: 'Raised container' },
  { token: 'popover', note: 'Menu, dropdown, dialog' },
  { token: 'muted', note: 'Quiet region inside a container' },
];

const textTones: { token: ColorToken; className: string; role: string; sample: string }[] = [
  {
    token: 'foreground',
    className: 'text-foreground',
    role: 'Ink',
    sample: 'The text a reader is here for: values, names, prose.',
  },
  {
    token: 'muted-foreground',
    className: 'text-muted-foreground',
    role: 'Supporting',
    sample: 'Labels, timestamps, descriptions — present, one step back.',
  },
  {
    token: 'placeholder',
    className: 'text-placeholder',
    role: 'Absent',
    sample: 'Text that stands for something not written yet.',
  },
];

const accentKeys = Object.keys(Colors).filter(key => /^accent\d$/.test(key)) as ColorToken[];
const accentDarkKeys = Object.keys(Colors).filter(key => /^accent\dDark$/.test(key)) as ColorToken[];
const accentDarkerKeys = Object.keys(Colors).filter(key => /^accent\dDarker$/.test(key)) as ColorToken[];

const chartSeries = [1, 2, 3, 4, 5] as const;

const tokenCount =
  backgrounds.length +
  grayTokens.length +
  grayAlphaTokens.length +
  surfaceRoles.length +
  textTones.length +
  2 +
  accentKeys.length +
  accentDarkKeys.length +
  accentDarkerKeys.length +
  chartSeries.length * 2;

const Swatch = ({ value, height = 'h-16' }: { value: string; height?: string }) => (
  <div
    role="img"
    aria-label={`${value} swatch`}
    className={`${height} border-border border`}
    style={{ background: value }}
  />
);

const RampRow = ({ tokens }: { tokens: string[] }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
      {tokens.map((token, index) => (
        <Specimen key={token} name={String(index + 1)}>
          <Swatch value={`var(--${token})`} />
        </Specimen>
      ))}
    </div>
    <div className="flex items-center justify-between gap-4">
      <Txt variant="meta" font="mono" tone="muted" className="uppercase">
        Subtle
      </Txt>
      <div className="bg-border h-px flex-1" />
      <Txt variant="meta" font="mono" tone="muted" className="uppercase">
        Strong
      </Txt>
    </div>
  </div>
);

const AccentRow = ({ label, tokens }: { label: string; tokens: ColorToken[] }) => (
  <SpecimenGroup label={label}>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tokens.map(token => (
        <Specimen key={token} name={`--${token}`}>
          <Swatch value={Colors[token]} />
        </Specimen>
      ))}
    </div>
  </SpecimenGroup>
);

export const ColorFoundations: Story = {
  name: 'Color foundations',
  render: (_args, context) => (
    <FoundationPage
      eyebrow={`Color / ${tokenCount} tokens`}
      title="Color foundations"
      description="Backgrounds encode nesting. Gray encodes contrast. Semantic roles name what a component is asking for, so the same markup holds in both themes."
      aside={
        <Txt variant="meta" font="mono" tone="muted" className="uppercase">
          Mode / {context.globals.backgrounds?.value === 'light' ? 'Light' : 'Dark'}
        </Txt>
      }
      note="Foundation CSS properties. Components reference the semantic roles, never the ramp."
      noteAside="Gray runs from subtle 1 to strong 10."
    >
      <FoundationSection label="Backgrounds" description="The three structural surfaces, outer to inner.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {backgrounds.map(background => (
            <Specimen key={background.token} name={`--${background.token}`} note={background.role}>
              <Swatch value={`var(--${background.token})`} height="h-24" />
            </Specimen>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Gray"
        description="Contrast, not lightness — the direction reverses per theme, the step keeps its role."
      >
        <RampRow tokens={grayTokens} />
      </FoundationSection>

      <FoundationSection
        label="Gray alpha"
        description="The same ramp as transparency, for anything that has to tint the surface under it."
        surface="sidebar"
      >
        <RampRow tokens={grayAlphaTokens} />
      </FoundationSection>

      <FoundationSection label="Surfaces" description="The role a container asks for instead of a ramp step.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {surfaceRoles.map(surface => (
            <Specimen key={surface.token} name={`--${surface.token}`} note={surface.note}>
              <Swatch value={Colors[surface.token]} height="h-24" />
            </Specimen>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Text"
        description="Three tones, and the distance between them is the whole hierarchy — never a fourth grey."
      >
        <div className="flex flex-col gap-4">
          {textTones.map(tone => (
            <div key={tone.token} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline sm:gap-4">
              <div className="flex items-baseline gap-2">
                <Txt variant="meta" font="mono" tone="muted">
                  --{tone.token}
                </Txt>
                <Txt variant="meta" tone="faint">
                  {tone.role}
                </Txt>
              </div>
              <Txt variant="body" className={tone.className}>
                {tone.sample}
              </Txt>
            </div>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Destructive"
        description="The one chromatic role in the shell: a destructive action and the text that rides on it."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-40">
            <Specimen name="--destructive" note="Danger fill and message text">
              <Swatch value={Colors.destructive} />
            </Specimen>
          </div>
          <div className="w-40">
            <Specimen name="--destructive-foreground" note="Only on a destructive fill">
              <Swatch value={Colors['destructive-foreground']} />
            </Specimen>
          </div>
          <div className="flex items-center gap-3">
            <Txt variant="caption" className="text-destructive">
              Field is required.
            </Txt>
            <span className="bg-destructive text-label text-destructive-foreground inline-flex rounded-md px-3 py-1">
              Delete thread
            </span>
          </div>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Accents"
        description="Hue for status and series, not for chrome: a base, a filled background and a deeper one."
      >
        <AccentRow label="Base" tokens={accentKeys} />
        <AccentRow label="Dark" tokens={accentDarkKeys} />
        <AccentRow label="Darker" tokens={accentDarkerKeys} />
      </FoundationSection>

      <FoundationSection
        label="Charts"
        description="Two series palettes for recharts: categorical, where neighbouring series must be told apart, and soft, one hue stepped by lightness for an ordered series."
      >
        <SpecimenGroup label="Categorical">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {chartSeries.map(series => (
              <Specimen key={series} name={`--chart-${series}`}>
                <Swatch value={`var(--chart-${series})`} />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
        <SpecimenGroup label="Soft, ordered by lightness">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {chartSeries.map(series => (
              <Specimen key={series} name={`--chart-soft-${series}`}>
                <Swatch value={`var(--chart-soft-${series})`} />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>
    </FoundationPage>
  ),
};
