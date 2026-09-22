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

const neutralTokens: { token: ColorToken; note?: string }[] = [
  { token: 'neutral1' },
  { token: 'neutral2' },
  { token: 'neutral3' },
  { token: 'neutral4' },
  { token: 'neutral5' },
  { token: 'neutral6', note: 'Within rounding of --gray-10' },
];

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

const chartSeriesTokens = [
  { token: 'chart-blue', note: 'Primary series: p50 latency, input tokens, completed runs' },
  { token: 'chart-blue-deep', note: 'Lower segment of a stack topped by --chart-blue' },
  { token: 'chart-yellow', note: 'Second series beside blue: p95 latency, output tokens' },
  { token: 'chart-green', note: 'First scorer series' },
  { token: 'chart-purple', note: 'Cost, in tokens and in currency' },
  { token: 'chart-orange', note: 'Scorer datasets, fourth scorer series' },
  { token: 'chart-pink', note: 'Errors, stacked on --chart-blue-deep' },
  { token: 'chart-red', note: 'Errors, stacked on --chart-blue' },
];

const chartSoftSteps = [1, 2, 3, 4, 5];

const spanTypeTokens = [
  { token: 'span-type-agent', label: 'Agent' },
  { token: 'span-type-workflow', label: 'Workflow' },
  { token: 'span-type-model', label: 'Model' },
  { token: 'span-type-mcp', label: 'MCP' },
  { token: 'span-type-tool', label: 'Tool' },
  { token: 'span-type-provider', label: 'Provider Tool' },
  { token: 'span-type-memory', label: 'Memory' },
  { token: 'span-type-workspace', label: 'Workspace' },
  { token: 'span-type-skill', label: 'Skill' },
  { token: 'span-type-scorer', label: 'Scorer' },
  { token: 'span-type-other', label: 'Other' },
];

const tokenCount =
  backgrounds.length +
  grayTokens.length +
  grayAlphaTokens.length +
  neutralTokens.length +
  surfaceRoles.length +
  textTones.length +
  2 +
  accentKeys.length +
  accentDarkKeys.length +
  accentDarkerKeys.length +
  chartSeriesTokens.length +
  chartSoftSteps.length +
  spanTypeTokens.length;

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

const SeriesSwatch = ({ value }: { value: string }) => (
  <div role="img" aria-label={`${value} swatch`} className="border-border flex flex-col border">
    <div className="bg-background p-1.5">
      <span className="block h-8 rounded-sm" style={{ background: value }} />
    </div>
    <div className="bg-sidebar flex h-8 items-center gap-1.5 px-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ background: value }} />
      <span className="h-0.5 flex-1 rounded-full" style={{ background: value }} />
    </div>
  </div>
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
          Mode / {context.globals.theme === 'light' ? 'Light' : 'Dark'}
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

      <FoundationSection
        label="Neutral — legacy"
        description="A second ink ramp, six steps against gray's ten, and the two only meet at the ink end — everything below --neutral6 lands between gray rungs, differently in each theme. It is here because the product still reads it, not as a choice for new work, which takes a semantic role, or a gray rung when no role fits."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {neutralTokens.map(neutral => (
            <Specimen key={neutral.token} name={`--${neutral.token}`} note={neutral.note}>
              <Swatch value={Colors[neutral.token]} />
            </Specimen>
          ))}
        </div>
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
        description="Series colour picked by role, one hue stepped by lightness for an ordered measure, and an identity colour per span type. Every specimen paints its token as a fill on the canvas and as a dot and a line on the sidebar, the three marks these colours ship as."
      >
        <SpecimenGroup label="Categorical, by role">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {chartSeriesTokens.map(series => (
              <Specimen key={series.token} name={`--${series.token}`} note={series.note}>
                <SeriesSwatch value={`var(--${series.token})`} />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
        <SpecimenGroup label="Ordered by lightness">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {chartSoftSteps.map(step => (
              <Specimen key={step} name={`--chart-soft-${step}`}>
                <SeriesSwatch value={`var(--chart-soft-${step})`} />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
        <SpecimenGroup label="Span types, trace timeline">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {spanTypeTokens.map(span => (
              <Specimen key={span.token} name={`--${span.token}`} note={span.label}>
                <SeriesSwatch value={`var(--${span.token})`} />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>
    </FoundationPage>
  ),
};
