import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Colors } from './colors';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';

const meta = {
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
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

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

const hues = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const statusRoles = ['destructive', 'warning', 'success', 'info'];
const products = [
  { role: 'studio', label: 'Studio' },
  { role: 'server', label: 'Server' },
  { role: 'observability', label: 'Observability' },
  { role: 'factory', label: 'Factory' },
  { role: 'workers', label: 'Workers' },
  { role: 'persistent-server', label: 'Persistent server' },
] as const;

const chartSeriesTokens = [
  { token: 'chart-1', note: 'Primary series: p50 latency, input tokens, completed runs' },
  { token: 'chart-2', note: 'Lower segment of a stack topped by --chart-1' },
  { token: 'chart-3', note: 'Second series beside blue: p95 latency, output tokens' },
  { token: 'chart-4', note: 'First scorer series' },
  { token: 'chart-5', note: 'Cost, in tokens and in currency' },
  { token: 'chart-6', note: 'Scorer datasets, fourth scorer series' },
  { token: 'chart-7', note: 'Errors, stacked on --chart-2' },
  { token: 'chart-8', note: 'Errors, stacked on --chart-1' },
];

const chartSoftSteps = [1, 2, 3, 4, 5];

const spanTypeTokens = [
  { token: 'span-agent', label: 'Agent' },
  { token: 'span-workflow', label: 'Workflow' },
  { token: 'span-model', label: 'Model' },
  { token: 'span-mcp', label: 'MCP' },
  { token: 'span-tool', label: 'Tool' },
  { token: 'span-provider', label: 'Provider Tool' },
  { token: 'span-memory', label: 'Memory' },
  { token: 'span-workspace', label: 'Workspace' },
  { token: 'span-skill', label: 'Skill' },
  { token: 'span-scorer', label: 'Scorer' },
  { token: 'span-other', label: 'Other' },
];

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
  name: 'Ramps',
  parameters: {
    docs: {
      description: {
        story: 'Background, gray, and chromatic scales. Components use semantic roles rather than raw ramp steps.',
      },
    },
  },
  render: () => (
    <FoundationPage
      eyebrow="Color"
      title="Ramps"
      description="Background, gray, and chromatic scales. Components use semantic roles rather than raw ramp steps."
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
        label="Chromatic ramps"
        description="Shared primitives, from light 50 to dark 950. Roles select a step for each theme."
      >
        {hues.map(hue => (
          <SpecimenGroup key={hue} label={hue}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
              {steps.map(step => (
                <Specimen key={step} name={`--${hue}-${step}`}>
                  <Swatch value={`var(--${hue}-${step})`} />
                </Specimen>
              ))}
            </div>
          </SpecimenGroup>
        ))}
      </FoundationSection>
    </FoundationPage>
  ),
};

export const SemanticColors: Story = {
  parameters: {
    docs: { description: { story: 'Surface, text, and status roles. Values adapt to the active theme.' } },
  },
  render: () => (
    <FoundationPage
      eyebrow="Color"
      title="Semantic Colors"
      description="Surface, text, and status roles. Values adapt to the active theme."
    >
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
        description="Destructive actions keep a separate fill and on-fill foreground."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-40">
            <Specimen name="--destructive" note="Destructive action fill">
              <Swatch value={Colors.destructive} />
            </Specimen>
          </div>
          <div className="w-40">
            <Specimen name="--destructive-foreground" note="Only on a destructive fill">
              <Swatch value={Colors['destructive-foreground']} />
            </Specimen>
          </div>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Status roles"
        description="Opaque surfaces, boundaries, indicators, and text. The same names resolve in both themes."
      >
        {statusRoles.map(role => (
          <SpecimenGroup key={role} label={role}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['bg', 'border', 'indicator', 'fg'].map(part => (
                <Specimen key={part} name={`--${role}-${part}`}>
                  <Swatch value={`var(--${role}-${part})`} />
                </Specimen>
              ))}
            </div>
          </SpecimenGroup>
        ))}
      </FoundationSection>
    </FoundationPage>
  ),
};

export const ProductColors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Background and foreground pairs for each product. Component examples live under Elements / Products.',
      },
    },
  },
  render: () => (
    <FoundationPage
      eyebrow="Color"
      title="Product Colors"
      description="Background and foreground pairs for each product. Component examples live under Elements / Products."
    >
      <FoundationSection label="Product roles" description="Product identity, with a paired surface and foreground.">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {products.map(({ role, label }) => (
            <SpecimenGroup key={role} label={label}>
              <div className="grid grid-cols-2 gap-3">
                {['bg', 'fg'].map(part => (
                  <Specimen key={part} name={`--product-${role}-${part}`}>
                    <Swatch value={`var(--product-${role}-${part})`} />
                  </Specimen>
                ))}
              </div>
            </SpecimenGroup>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};

export const Charts: Story = {
  render: () => (
    <FoundationPage
      eyebrow={`Color / ${chartSeriesTokens.length + chartSoftSteps.length} tokens`}
      title="Charts"
      description="Categorical series and sequential scales, shown as fills, dots, and lines."
    >
      <FoundationSection
        label="Chart colors"
        description="Use categorical roles for distinct series and sequential steps for ordered values."
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
              <Specimen key={step} name={`--chart-sequential-${step}`}>
                <SeriesSwatch value={`var(--chart-sequential-${step})`} />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>
    </FoundationPage>
  ),
};

export const SpanTypes: Story = {
  name: 'Span types',
  render: () => (
    <FoundationPage
      eyebrow={`Color / ${spanTypeTokens.length} tokens`}
      title="Span types"
      description="Identity colors for spans in the trace timeline."
    >
      <FoundationSection label="Trace timeline" description="The same span role resolves in light and dark themes.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {spanTypeTokens.map(span => (
            <Specimen key={span.token} name={`--${span.token}`} note={span.label}>
              <SeriesSwatch value={`var(--${span.token})`} />
            </Specimen>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};

const brandColors = [
  { name: 'Green', token: 'ds-green', hex: '#7aff78' },
  { name: 'Orange', token: 'ds-orange', hex: '#fdac53' },
  { name: 'Pink', token: 'ds-pink', hex: '#ff69cc' },
  { name: 'Purple', token: 'ds-purple', hex: '#b588fe' },
  { name: 'Blue', token: 'ds-blue', hex: '#6ccdfb' },
  { name: 'Red', token: 'ds-red', hex: '#ff4758' },
  { name: 'Yellow', token: 'ds-yellow', hex: '#e7e67b' },
];

export const BrandColors: Story = {
  render: () => (
    <FoundationPage
      eyebrow="Color / 7 brand colors"
      title="Brand Colors"
      description="Mastra's brand palette. These values stay the same in light and dark themes."
    >
      <FoundationSection label="Mastra" description="Brand colors are separate from status and chart roles.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {brandColors.map(({ name, token, hex }) => (
            <SpecimenGroup key={token} label={name}>
              <Specimen name={`--color-${token}`} note={hex}>
                <Swatch value={`var(--color-${token})`} />
              </Specimen>
            </SpecimenGroup>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
