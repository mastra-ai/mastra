import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { FoundationPage, FoundationSection, Specimen } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Elevation',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One recipe carries elevation: --shadow-raised. It draws the rim as well as the drop, so a raised surface never adds a border of its own, and nothing else in the system casts a shadow.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const ElevationFoundations: Story = {
  name: 'Elevation foundations',
  render: () => (
    <FoundationPage
      eyebrow="Elevation / 1 token"
      title="Elevation foundations"
      description="Elevation says a surface floats and is dismissible. One recipe covers every raised surface in the shell: app frame, card, popover, dropdown, dialog, tooltip, drawer."
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
        label="Not elevation"
        description="The focus halo is the only other box-shadow in the system. It belongs to focus, not to depth — it is documented on the Surface page beside --border-focus and --ring."
      >
        <Specimen name="--shadow-focus-ring" note="Paired with ring-accent1 by focusRing.visible">
          <div className="bg-background flex h-20 items-center justify-center rounded-xl p-4">
            <div className="bg-fill shadow-focus-ring ring-accent1 rounded-md px-3 py-1.5 ring-1">
              <Txt variant="label">Focused row</Txt>
            </div>
          </div>
        </Specimen>
      </FoundationSection>
    </FoundationPage>
  ),
};
