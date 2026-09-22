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
          'Two utilities carry elevation: shadow-raised for a surface in the flow, shadow-overlay for a detached one. Each assembles the lip, the 1px rim and the drops, so a raised surface never adds a border of its own, and nothing else in the system casts a shadow.',
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
      eyebrow="Elevation / 2 tokens"
      title="Elevation foundations"
      description="Elevation encodes distance from the canvas, and the product has two distances: a surface that sits in the flow, and one that is detached and dismissible."
      note="Neither draws a border: both tokens already contain a 1px ring and, in dark, a top inset highlight."
      noteAside="Utilities: shadow-raised, shadow-overlay, from src/index.css."
    >
      <FoundationSection
        label="Raised — in the flow"
        description="App frame, card, list panel, settings container, table head. The bleed stays short on purpose: a tile in a grid inside a scroller is clipped by that scroller, and a shadow reaching past the tile's clearance is sliced into a hard line along the container edge."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="shadow-raised" note="raisedSurfaceStyle — the class pair components share">
            <div className="bg-card shadow-raised flex h-32 flex-col justify-end rounded-xl p-4">
              <Txt variant="label">Raised surface</Txt>
              <Txt variant="caption" tone="muted">
                Rim and drop from one token
              </Txt>
            </div>
          </Specimen>
          <Specimen name="Tiles in a grid" note="Short bleed, so neighbours and the container edge stay clean">
            <div className="bg-background grid h-32 grid-cols-2 gap-2 overflow-hidden rounded-xl p-2">
              {['Tile', 'Tile'].map((label, index) => (
                <div key={index} className="bg-card shadow-raised rounded-lg p-3">
                  <Txt variant="caption" tone="muted">
                    {label}
                  </Txt>
                </div>
              ))}
            </div>
          </Specimen>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Overlay — detached"
        description="Popover, dropdown, dialog, drawer, tooltip, a dragged item. Never clipped, and it has to separate from whatever content it lands on, so the falloff carries further."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="shadow-overlay" note="overlaySurfaceStyle — the class pair popups share">
            <div className="bg-card shadow-overlay flex h-32 flex-col justify-end rounded-xl p-4">
              <Txt variant="label">Overlay surface</Txt>
              <Txt variant="caption" tone="muted">
                Same rim, longer falloff
              </Txt>
            </div>
          </Specimen>
          <Specimen name="Over content" note="A nested surface keeps the recipe, never a second border">
            <div className="bg-background flex h-32 items-center justify-center rounded-xl p-4">
              <div className="bg-card shadow-overlay w-full rounded-lg p-3">
                <Txt variant="caption" tone="muted">
                  Reads as lifted off the surface beneath it.
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
