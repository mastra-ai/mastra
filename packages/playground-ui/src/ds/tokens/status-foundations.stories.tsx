import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, type BadgeVariant } from '../components/Badge';
import { Notice, type NoticeVariant } from '../components/Notice';
import { Txt } from '../components/Txt/Txt';
import { Colors } from './colors';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Status',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three families carry state: a notice tints a whole message, a badge labels one row, and the green ramp supplies success colors. Each family ships a base and a matching foreground, because a status is always a wash plus the ink that has to stay legible on it.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type ColorToken = keyof typeof Colors;

const noticeVariants: { variant: NoticeVariant; title: string; message: string; note: string }[] = [
  {
    variant: 'success',
    title: 'Deployed',
    message: 'The workflow finished and every step reported back.',
    note: 'Solid surface with a separate border and foreground',
  },
  {
    variant: 'destructive',
    title: 'Run failed',
    message: 'The agent stopped after three retries on the same tool call.',
    note: 'The loudest notice — reserved for something that stopped',
  },
  {
    variant: 'warning',
    title: 'Approaching the limit',
    message: 'This thread is close to the context window.',
    note: 'Still working, but on a path that ends badly',
  },
  {
    variant: 'info',
    title: 'Streaming',
    message: 'Output appears as the model produces it.',
    note: 'Ambient state, nothing to act on',
  },
  {
    variant: 'note',
    title: 'Aside',
    message: 'Documentation lifted out of the flow of a message.',
    note: 'Neutral surface with the shared border',
  },
];

const badgeHues: BadgeVariant[] = ['success', 'destructive', 'info', 'warning', 'purple', 'orange', 'cyan', 'pink'];
const badgeTokenHue: Partial<Record<BadgeVariant, string>> = {
  success: 'green',
  destructive: 'red',
  info: 'blue',
  warning: 'yellow',
};

const greenSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const statusAliases: { token: ColorToken; note: string }[] = [
  { token: 'warning-indicator', note: 'Pending or needs attention' },
  { token: 'success-indicator', note: 'Completed or connected' },
  { token: 'destructive-indicator', note: 'Failed or unavailable' },
  { token: 'info-indicator', note: 'Informational state' },
];

export const StatusFoundations: Story = {
  name: 'Status foundations',
  render: (_args, context) => (
    <FoundationPage
      eyebrow="Status"
      title="Status foundations"
      description="Notice and badge examples show status roles in context. Color / Token registry lists every fill, edge, indicator, and foreground, including roles these examples do not use."
      aside={
        <Txt variant="meta" font="mono" tone="muted" className="uppercase">
          Mode / {context.globals.theme === 'light' ? 'Light' : 'Dark'}
        </Txt>
      }
      note="Light is not the dark value dimmed: the base keeps its saturation while the foreground flips to a deep tint, because ink has to darken when the surface turns white."
      noteAside="Utilities: bg-{status}-subtle, border-{status}-edge, text-{status}-subtle-foreground, bg-badge-{hue}-strong, text-badge-{hue}-foreground."
    >
      <FoundationSection
        label="Notice"
        description="Admonitions, rendered here by the Notice component itself so the page cannot drift from it. Status roles supply an opaque background, border, and foreground."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {noticeVariants.map(entry => (
            <Specimen
              key={entry.variant}
              name={
                entry.variant === 'note'
                  ? '--muted / --foreground'
                  : `--${entry.variant}-subtle / --${entry.variant}-subtle-foreground`
              }
              note={entry.note}
            >
              <Notice variant={entry.variant} title={entry.title}>
                <Notice.Message>{entry.message}</Notice.Message>
              </Notice>
            </Specimen>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Badge"
        description="One row's worth of status. The labels below name the strong fill and foreground; the examples also use subtle fills and indicators. The registry names each token."
        surface="sidebar"
      >
        <SpecimenGroup label="Neutral">
          <div className="max-w-80">
            <Specimen name="--badge-neutral-foreground" note="Ink only — the fill is --fill, no hue to pair with">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Draft</Badge>
                <Badge emphasis="subtle">Draft</Badge>
                <Badge indicator="dot">Draft</Badge>
              </div>
            </Specimen>
          </div>
        </SpecimenGroup>
        <SpecimenGroup label="Hues">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {badgeHues.map(hue => (
              <Specimen
                key={hue}
                name={`--badge-${badgeTokenHue[hue] ?? hue}-strong / --badge-${badgeTokenHue[hue] ?? hue}-foreground`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={hue}>{hue}</Badge>
                  <Badge variant={hue} emphasis="subtle">
                    {hue}
                  </Badge>
                  <Badge variant={hue} indicator="dot">
                    {hue}
                  </Badge>
                </div>
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Success green"
        description="The shared green ramp supplies success colors. Mastra brand green is shown separately in Color / Brand Colors."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {greenSteps.map(step => (
            <Specimen key={step} name={`--green-${step}`} note={`bg-green-${step}`}>
              <div
                role="img"
                aria-label={`green ${step} swatch`}
                className="h-16 border border-border"
                style={{ background: Colors[`green-${step}`] }}
              />
            </Specimen>
          ))}
        </div>
        <Txt variant="caption" tone="muted">
          Success indicators use step 400 in dark mode and step 700 in light mode.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Semantic aliases"
        description="Status indicators point to the chromatic ramps and adapt to the active theme."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statusAliases.map(alias => (
            <Specimen key={alias.token} name={`--${alias.token}`} note={alias.note}>
              <div
                role="img"
                aria-label={`${alias.token} swatch`}
                className="flex h-16 overflow-hidden border border-border"
              >
                <div className="flex-1" style={{ background: Colors[alias.token] }} />
              </div>
            </Specimen>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
