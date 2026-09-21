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
          'Three families carry state: a notice tints a whole message, a badge labels one row, and the brand green ramp is the product colour underneath both. Each family ships a base and a matching foreground, because a status is always a wash plus the ink that has to stay legible on it.',
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
    note: 'Base at 20% for the wash and the rim, foreground at full',
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
    note: 'The one opaque base: a surface, not a tint, so it takes --border',
  },
];

const badgeHues: BadgeVariant[] = ['green', 'red', 'blue', 'yellow', 'purple', 'orange', 'cyan', 'pink'];

const greenSteps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const statusAliases: { token: ColorToken; aliasOf?: ColorToken; note: string }[] = [
  { token: 'text1', aliasOf: 'neutral6', note: 'Alias of --neutral6 — body ink' },
  { token: 'warning1', aliasOf: 'accent6', note: 'Alias of --accent6 — amber' },
  { token: 'positive1', aliasOf: 'accent1', note: 'Alias of --accent1 — green' },
  { token: 'negative1', aliasOf: 'accent2', note: 'Alias of --accent2 — red' },
  { token: 'error', note: 'Its own red, off the ramp — form and request failures' },
];

const tokenCount = noticeVariants.length * 2 + (badgeHues.length * 2 + 1) + greenSteps.length + statusAliases.length;

export const StatusFoundations: Story = {
  name: 'Status foundations',
  render: (_args, context) => (
    <FoundationPage
      eyebrow={`Status / ${tokenCount} tokens`}
      title="Status foundations"
      description="Status is the only place the shell is allowed to be chromatic, so each family is deliberately small: five notices, eight badge hues, one brand ramp. Hue carries the meaning; the paired foreground carries the contrast."
      aside={
        <Txt variant="meta" font="mono" tone="muted" className="uppercase">
          Mode / {context.globals.theme === 'light' ? 'Light' : 'Dark'}
        </Txt>
      }
      note="Light is not the dark value dimmed: the base keeps its saturation while the foreground flips to a deep tint, because ink has to darken when the surface turns white."
      noteAside="Utilities: bg-notice-*, text-notice-*-fg, bg-badge-*, text-badge-*-fg."
    >
      <FoundationSection
        label="Notice"
        description="Admonitions, rendered here by the Notice component itself so the page cannot drift from it. The base paints the wash and the rim at 20% alpha, never the text; the -fg is the text and icon on top of it."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {noticeVariants.map(entry => (
            <Specimen
              key={entry.variant}
              name={`--notice-${entry.variant} / --notice-${entry.variant}-fg`}
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
        description="One row's worth of status. Same two-part recipe as a notice at a smaller scale: the base fills at 20%, at 10% when muted, and solid for the indicator dot; the -fg is the label."
        surface="sidebar"
      >
        <SpecimenGroup label="Neutral">
          <div className="max-w-80">
            <Specimen name="--badge-neutral-fg" note="Ink only — the fill is --neutral6 at 5%, no hue to pair with">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Draft</Badge>
                <Badge emphasis="muted">Draft</Badge>
                <Badge indicator="dot">Draft</Badge>
              </div>
            </Specimen>
          </div>
        </SpecimenGroup>
        <SpecimenGroup label="Hues">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {badgeHues.map(hue => (
              <Specimen key={hue} name={`--badge-${hue} / --badge-${hue}-fg`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={hue}>{hue}</Badge>
                  <Badge variant={hue} emphasis="muted">
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
        label="Brand green"
        description="The product colour, as an eleven-step ramp. theme.css clears Tailwind's own green and remaps the scale onto this ramp, so bg-green-500 in this codebase is brand green — reading a Tailwind swatch to predict it will be wrong."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {greenSteps.map(step => (
            <Specimen key={step} name={`--brand-green-${step}`} note={`bg-green-${step}`}>
              <div
                role="img"
                aria-label={`brand green ${step} swatch`}
                className="border-border h-16 border"
                style={{ background: Colors[`green-${step}`] }}
              />
            </Specimen>
          ))}
        </div>
        <Txt variant="caption" tone="muted">
          Step 500 is the notice success colour, which is why a healthy run and the brand read as the same green.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Semantic aliases"
        description="Older surfaces name a status instead of an accent. These are pointers onto the accent ramp, not a fourth palette — each swatch is split, alias on the left and source on the right, so a seam would mean one of them moved."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statusAliases.map(alias => (
            <Specimen key={alias.token} name={`--${alias.token}`} note={alias.note}>
              <div
                role="img"
                aria-label={`${alias.token} swatch`}
                className="border-border flex h-16 overflow-hidden border"
              >
                <div className="flex-1" style={{ background: Colors[alias.token] }} />
                {alias.aliasOf && <div className="flex-1" style={{ background: Colors[alias.aliasOf] }} />}
              </div>
            </Specimen>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
