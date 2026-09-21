import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { FontSizes, FontWeights, LineHeights } from './fonts';
import { FoundationPage, FoundationSection } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Typography',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

type TextRole = keyof typeof FontSizes;

const headingRoles: TextRole[] = ['display', 'title', 'heading', 'subheading'];
const textRoles: TextRole[] = ['body', 'label', 'body-sm', 'column', 'caption', 'meta'];

const samples: Record<TextRole, string> = {
  display: 'Build agents that ship',
  title: 'Agent overview',
  heading: 'Recent activity',
  subheading: 'Configuration',
  body: 'Prose and descriptions carry the reading load.',
  label: 'Control label',
  'body-sm': 'Table cells, menu items and field values',
  column: 'STATUS',
  caption: 'Secondary information and supporting copy',
  meta: 'METADATA · 12:42 PM',
};

const RoleRow = ({ role }: { role: TextRole }) => {
  const fontSizePx = Number.parseFloat(FontSizes[role]) * 16;
  const lineHeightPx = Math.round((fontSizePx * Number.parseFloat(LineHeights[role])) / 100);

  return (
    <div className="border-border grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[7rem_5.5rem_minmax(0,1fr)] sm:gap-3">
      <Txt variant="meta" font="mono" tone="muted">
        --text-{role}
      </Txt>
      <Txt variant="meta" font="mono" tone="faint">
        {Math.round(fontSizePx)}/{lineHeightPx} · {FontWeights[role]}
      </Txt>
      <Txt variant={role} className="min-w-0 truncate">
        {samples[role]}
      </Txt>
    </div>
  );
};

export const TypographyFoundations: Story = {
  name: 'Typography foundations',
  render: () => (
    <FoundationPage
      eyebrow={`Type / ${headingRoles.length + textRoles.length} roles`}
      title="Typography foundations"
      description="A role is one class carrying size, line height, weight and tracking. Components pick a role; they never assemble one out of a size plus a weight plus a leading."
      note="500 is the weight ceiling — hierarchy comes from size and tone."
      noteAside="Txt applies a role through its variant prop; markup applies the same role as text-<role>."
    >
      <FoundationSection label="Headings" description="Four roles for what a page, a panel and a section are called.">
        <div className="min-w-0">
          {headingRoles.map(role => (
            <RoleRow key={role} role={role} />
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Text"
        description="Six roles for everything read inside them, from prose down to a keycap."
      >
        <div className="min-w-0">
          {textRoles.map(role => (
            <RoleRow key={role} role={role} />
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
