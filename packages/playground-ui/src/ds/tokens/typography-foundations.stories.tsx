import type { Meta, StoryObj } from '@storybook/react-vite';
import { useCallback, useState } from 'react';
import { Txt } from '../components/Txt/Txt';
import type { TextRole } from './fonts';
import { FoundationPage, FoundationSection, Specimen } from './foundations-layout';
import { cn } from '@/lib/utils';

const meta: Meta = {
  title: 'Foundations/Typography',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

const headingRoles: TextRole[] = ['display', 'title', 'heading', 'subheading'];
const textRoles: TextRole[] = ['body', 'label', 'body-sm', 'column', 'caption', 'meta'];
const monoRoles: TextRole[] = ['body', 'body-sm', 'caption', 'meta'];

const families: { token: string; use: string; className: string; sample: string }[] = [
  {
    token: '--font-display',
    use: 'Headlines and brand — the onboarding hero',
    className: 'font-display',
    sample: 'Build agents that ship',
  },
  {
    token: '--font-body',
    use: 'Everything else, inherited rather than asked for',
    className: 'font-body',
    sample: 'The default, everywhere',
  },
  {
    token: '--font-mono',
    use: 'Anything the machine wrote: ids, code, timings',
    className: 'font-mono',
    sample: 'trace_01JQX8 · 412ms',
  },
];

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

const monoSamples: Partial<Record<TextRole, string>> = {
  body: '12:42:07.114 INFO agent finished in 412ms',
  'body-sm': 'run_01JQX8K2M4',
  caption: 'gpt-5.1 · 3f9a2c1e',
  meta: 'v2.1.0 · 3f9a2c1',
};

// The numbers are read off the rendered element rather than mirrored from a TypeScript
// copy of the tokens: the row then reports what the browser actually applied, and cannot
// drift from theme/typography.css.
const RoleRow = ({ role, font = 'body' }: { role: TextRole; font?: 'body' | 'mono' }) => {
  const [applied, setApplied] = useState('');

  const measure = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const { fontSize, lineHeight, fontWeight } = getComputedStyle(element);
    setApplied(
      `${Math.round(Number.parseFloat(fontSize))}/${Math.round(Number.parseFloat(lineHeight))} · ${fontWeight}`,
    );
  }, []);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-3 last:border-b-0 sm:grid-cols-[7rem_5.5rem_minmax(0,1fr)] sm:gap-3">
      <Txt variant="meta" font="mono" tone="muted">
        --text-{role}
      </Txt>
      <Txt variant="meta" font="mono" tone="faint">
        {applied}
      </Txt>
      <Txt ref={measure} variant={role} font={font} className="min-w-0 truncate">
        {font === 'mono' ? monoSamples[role] : samples[role]}
      </Txt>
    </div>
  );
};

const emojiFallback = /emoji|symbol/i;

const FamilySpecimen = ({ token, use, className, sample }: (typeof families)[number]) => {
  const [stack, setStack] = useState('');

  const measure = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const resolved = getComputedStyle(element).fontFamily.split(',');
    setStack(
      resolved
        .map(family => family.trim())
        .filter(family => !emojiFallback.test(family))
        .join(', '),
    );
  }, []);

  return (
    <Specimen name={token} note={use}>
      <div className="flex min-w-0 flex-col gap-2">
        <p ref={measure} className={cn('min-w-0 truncate text-title text-foreground', className)}>
          {sample}
        </p>
        <Txt variant="meta" font="mono" tone="faint" className="min-w-0 truncate" title={stack}>
          {stack}
        </Txt>
      </div>
    </Specimen>
  );
};

export const TypographyFoundations: Story = {
  name: 'Typography foundations',
  render: () => (
    <FoundationPage
      eyebrow={`Type / ${headingRoles.length + textRoles.length} roles · ${families.length} families`}
      title="Typography foundations"
      description="A role is one class carrying size, line height, weight and tracking. Components pick a role; they never assemble one out of a size plus a weight plus a leading."
      note="500 is the weight ceiling — hierarchy comes from size and tone."
      noteAside="Txt applies a role through its variant prop; markup applies the same role as text-<role>."
    >
      <FoundationSection
        label="Typeface"
        description="Three roles, three tokens. The package defaults them to system stacks so it carries no font licence; a product overrides the tokens in its own CSS and every text role follows — Studio points display and body at Mona Sans and mono at Commit Mono, which is what renders below. There is no serif family: display is a role, not a typeface."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {families.map(family => (
            <FamilySpecimen key={family.token} {...family} />
          ))}
        </div>
      </FoundationSection>

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

      <FoundationSection
        label="Monospace"
        description={`Mono is a face, not a role: font="mono" on Txt swaps the family and keeps the role's size, line height and weight. Use it for identifiers a machine wrote (model and resource ids, hashes, log lines), timestamps, and durations. Other numbers, such as token counts, stay in the body face with tabular-nums. Code goes in InlineCode or a highlighted CodeBlock. Labels, headings, status and prose stay proportional, even beside a mono value.`}
      >
        <div className="min-w-0">
          {monoRoles.map(role => (
            <RoleRow key={role} role={role} font="mono" />
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
