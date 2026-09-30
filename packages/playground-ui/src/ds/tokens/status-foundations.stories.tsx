import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, type BadgeVariant } from '../components/Badge';
import { Notice, type NoticeVariant } from '../components/Notice';
import { Txt } from '../components/Txt/Txt';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Status',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A notice tints a whole message; a badge labels one row. Their fills, edges, indicators, and foregrounds each have a named role. The green ramp they draw from lives in Color / Ramps.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

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
  warning: 'amber',
};

const statusRoles = ['success', 'destructive', 'warning', 'info'];
const statusParts = ['subtle', 'edge', 'indicator', 'bright', 'subtle-foreground'];
const badgeParts = ['strong', 'subtle', 'edge', 'indicator', 'foreground'];

const StatusSwatch = ({ token }: { token: string }) => (
  <Specimen name={`--${token}`}>
    <div
      role="img"
      aria-label={`--${token} swatch`}
      className="h-16 border border-border"
      style={{ background: `var(--${token})` }}
    />
  </Specimen>
);

export const StatusFoundations: Story = {
  name: 'Status foundations',
  render: (_args, context) => (
    <FoundationPage
      eyebrow="Status"
      title="Status foundations"
      description="Notice and badge examples show the roles in context. Each status and badge token is named once below, including roles these examples do not use."
      aside={
        <Txt variant="meta" font="mono" tone="muted" className="uppercase">
          Mode / {context.globals.theme === 'light' ? 'Light' : 'Dark'}
        </Txt>
      }
      note="Light is not the dark value dimmed: the base keeps its saturation while the foreground flips to a deep tint, because ink has to darken when the surface turns white."
      noteAside="Utilities: bg-{status}-subtle, border-{status}-edge, text-{status}-subtle-foreground, text-destructive-foreground, text-warning-foreground, bg-badge-{hue}-strong, text-badge-{hue}-foreground."
    >
      <FoundationSection
        label="Notice"
        description="Admonitions, rendered here by the Notice component itself so the page cannot drift from it. Status roles supply an opaque background, border, and foreground."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {noticeVariants.map(entry => (
            <Specimen key={entry.variant} name={entry.title} note={entry.note}>
              <Notice variant={entry.variant} title={entry.title}>
                <Notice.Message>{entry.message}</Notice.Message>
              </Notice>
            </Specimen>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Badge"
        description="One row's worth of status. Strong and subtle fills use the same foreground; indicators can stand beside either."
        surface="sidebar"
      >
        <SpecimenGroup label="Neutral">
          <div className="max-w-80">
            <Specimen name="Neutral badge" note="Its fill is --fill, with no hue to pair with">
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
              <Specimen key={hue} name={`${hue} badge`}>
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
        label="Status roles"
        description="Each notice has a fill, edge, indicator, and foreground. Bright is a lighter indicator for small live marks such as progress dots and activity belts. Warning and destructive also have a foreground for colored text and icons on the page, because their indicator fills are too light to read as text in light mode. Destructive controls also have a pressed subtle fill."
      >
        {statusRoles.map(role => (
          <SpecimenGroup key={role} label={role}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {statusParts.map(part => (
                <StatusSwatch key={part} token={`${role}-${part}`} />
              ))}
              {(role === 'destructive' || role === 'warning') && <StatusSwatch token={`${role}-foreground`} />}
              {role === 'destructive' && <StatusSwatch token="destructive-subtle-active" />}
            </div>
          </SpecimenGroup>
        ))}
        <SpecimenGroup label="session">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <StatusSwatch token="session-initializing" />
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Badge roles"
        description="The colored badges add strong and subtle fills, an edge, an indicator, and text."
      >
        <SpecimenGroup label="Neutral">
          <div className="max-w-40">
            <StatusSwatch token="badge-neutral-foreground" />
          </div>
        </SpecimenGroup>
        {badgeHues.map(hue => {
          const tokenHue = badgeTokenHue[hue] ?? hue;
          return (
            <SpecimenGroup key={hue} label={hue}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {badgeParts.map(part => (
                  <StatusSwatch key={part} token={`badge-${tokenHue}-${part}`} />
                ))}
              </div>
            </SpecimenGroup>
          );
        })}
      </FoundationSection>
    </FoundationPage>
  ),
};
