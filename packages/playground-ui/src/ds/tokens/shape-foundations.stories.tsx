import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { BorderRadius } from './borders';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';
import { Sizes } from './sizes';
import type { Spacing } from './spacings';

const meta: Meta = {
  title: 'Foundations/Shape',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Radius, spacing and the control sizes. Spacing is one multiplier rather than an enumeration, so every rung exists and a component never has to reach for an arbitrary value.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type RadiusToken = keyof typeof BorderRadius;
type SizeToken = keyof typeof Sizes;

const radiusNotes: Record<RadiusToken, string> = {
  none: 'Flush edge, table cell',
  sm: 'Chip, tag, small marker',
  md: 'Control: input, button, menu item',
  lg: 'Card, container',
  xl: 'Popover, dialog, floating panel',
};

// Rungs typed against the spacing mirror: a representative ladder, not the
// whole multiplier — `--spacing` generates every step between them.
const spacingRungs = ['1', '2', '3', '4', '6', '8', '12', '16', '24', '32'] as const satisfies readonly Spacing[];

const sizeKeys = Object.keys(Sizes) as SizeToken[];
const iconKeys = sizeKeys.filter(key => key.startsWith('icon-'));
const formKeys = sizeKeys.filter(key => key.startsWith('form-'));
const elementKeys = sizeKeys.filter(key => !key.startsWith('icon-') && !key.startsWith('form-'));

// A form rung is declared as a named spacing so it can size a height and a
// width from one token; everything else is declared as a height.
const sizeToken = (key: SizeToken) => (key.startsWith('form-') ? `--spacing-${key}` : `--height-${key}`);

const SizeRow = ({ token }: { token: SizeToken }) => (
  <div className="border-border grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-center gap-4 border-b py-2 last:border-b-0">
    <Txt variant="meta" font="mono" tone="muted" className="truncate">
      {sizeToken(token)}
    </Txt>
    <div
      role="img"
      aria-label={`${token} height`}
      className="border-border bg-fill w-40 rounded-md border"
      style={{ height: `var(${sizeToken(token)})` }}
    />
  </div>
);

export const ShapeFoundations: Story = {
  name: 'Shape foundations',
  render: () => (
    <FoundationPage
      eyebrow={`Shape / ${Object.keys(BorderRadius).length + 1 + sizeKeys.length} tokens`}
      title="Shape foundations"
      description="Radius carries how solid a surface is meant to feel, spacing is a single multiplier, and the control sizes are named so a button, a field and a row agree on one height."
      note="Spacing rungs are multipliers of --spacing, so p-13 and max-w-140 resolve like any other step."
      noteAside="Utilities: rounded-*, p-/m-/gap-*, h-*, w-*."
    >
      <FoundationSection
        label="Radius"
        description="Five steps, chosen by how large the surface is — a chip is not rounded like a dialog."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(Object.keys(BorderRadius) as RadiusToken[]).map(token => (
            <Specimen key={token} name={`--radius-${token}`} note={radiusNotes[token]}>
              <div
                role="img"
                aria-label={`radius ${token}`}
                className="border-border-strong bg-fill h-20 border"
                style={{ borderRadius: `var(--radius-${token})` }}
              />
            </Specimen>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Spacing"
        description="One multiplier. The rung is the number in the utility, so gap-4 and p-4 are the same distance."
      >
        <div className="flex min-w-0 flex-col gap-2">
          {spacingRungs.map(rung => (
            <div key={rung} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-4">
              <Txt variant="meta" font="mono" tone="muted">
                × {rung}
              </Txt>
              <div
                role="img"
                aria-label={`spacing ${rung}`}
                className="bg-fill-strong h-3 rounded-sm"
                style={{ width: `calc(var(--spacing) * ${rung})` }}
              />
            </div>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Sizes"
        description="Named heights, so every control in a row lands on the same baseline instead of a guessed pixel value."
      >
        <SpecimenGroup label="Icons">
          <div className="flex flex-wrap items-end gap-6">
            {iconKeys.map(token => (
              <div key={token} className="w-32">
                <Specimen name={sizeToken(token)} note="Also --width-* and --container-*">
                  <div
                    role="img"
                    aria-label={`${token} icon box`}
                    className="bg-fill-strong rounded-sm"
                    style={{ height: `var(--height-${token})`, width: `var(--width-${token})` }}
                  />
                </Specimen>
              </div>
            ))}
          </div>
        </SpecimenGroup>

        <SpecimenGroup label="Form controls">
          <div className="min-w-0">
            {formKeys.map(token => (
              <SizeRow key={token} token={token} />
            ))}
          </div>
        </SpecimenGroup>

        <SpecimenGroup label="Elements">
          <div className="min-w-0">
            {elementKeys.map(token => (
              <SizeRow key={token} token={token} />
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>
    </FoundationPage>
  ),
};
