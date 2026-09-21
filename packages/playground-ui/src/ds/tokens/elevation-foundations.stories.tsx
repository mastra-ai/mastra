import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Colors } from './colors';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';
import { Glows } from './shadows';

const meta: Meta = {
  title: 'Foundations/Elevation',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One recipe carries elevation: --shadow-raised. It draws the rim as well as the drop, so a raised surface never adds a border of its own. Beside it, only the coloured glows remain — a status marker and the focus halo.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type GlowToken = keyof typeof Glows;

const glowTokens: Record<GlowToken, { note: string; surface: string }> = {
  'glow-accent1': { note: 'Succeeded step marker', surface: Colors.accent1Dark },
  'glow-accent2': { note: 'Failed step marker', surface: Colors.accent2Dark },
  'focus-ring': { note: 'Focus halo, paired with ring-accent1', surface: Colors.fill },
};

const glowKeys = Object.keys(Glows) as GlowToken[];

export const ElevationFoundations: Story = {
  name: 'Elevation foundations',
  render: () => (
    <FoundationPage
      eyebrow={`Elevation / ${glowKeys.length + 1} tokens`}
      title="Elevation foundations"
      description="Elevation says a surface floats and is dismissible. One recipe covers every raised surface in the shell; a coloured halo is the only shadow allowed to carry hue."
      note="A raised surface never draws a border: --shadow-raised already contains a 1px ring and, in dark, a top inset highlight."
      noteAside="Utility: shadow-raised, from src/index.css."
    >
      <FoundationSection
        label="Raised"
        description="The one elevation recipe, shared by every surface that floats above the canvas."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="--shadow-raised" note="App frame, card, popover, dropdown, dialog, tooltip, drawer">
            <div className="bg-card shadow-raised flex h-32 flex-col justify-end rounded-xl p-4">
              <Txt variant="label">Raised surface</Txt>
              <Txt variant="caption" tone="muted">
                Rim and drop from one token
              </Txt>
            </div>
          </Specimen>
          <Specimen name="bg-card shadow-raised" note="raisedSurfaceStyle — the class pair components share">
            <div className="bg-background flex h-32 items-center justify-center rounded-xl p-4">
              <div className="bg-card shadow-raised w-full rounded-lg p-3">
                <Txt variant="caption" tone="muted">
                  Nested: a raised surface inside another one keeps the same recipe, never a second border.
                </Txt>
              </div>
            </div>
          </Specimen>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Glows"
        description="Coloured halos for a status marker and for focus — the only shadows allowed to carry hue."
      >
        <SpecimenGroup label="On the surface they are used on">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:max-w-200">
            {glowKeys.map(key => (
              <Specimen key={key} name={`--shadow-${key}`} note={glowTokens[key].note}>
                <div
                  role="img"
                  aria-label={`glow ${key}`}
                  className="h-20 rounded-md"
                  style={{ background: glowTokens[key].surface, boxShadow: `var(--shadow-${key})` }}
                />
              </Specimen>
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>
    </FoundationPage>
  ),
};
