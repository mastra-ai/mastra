import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../components/Badge/Badge';
import { ProductAvatar } from '../components/ProductAvatar/ProductAvatar';
import { ProductBadge } from '../components/ProductBadge/ProductBadge';
import { Txt } from '../components/Txt/Txt';
import { FoundationPage, FoundationSection, Specimen } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Elevation',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three utilities carry elevation: shadow-raised for a surface in the flow, shadow-overlay for a detached one, and shadow-inset for a small filled mark such as a badge or avatar. Each assembles its own lip and 1px rim, so none of them adds a border of its own, and nothing else in the system casts a shadow.',
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
      eyebrow="Elevation / 3 utilities"
      title="Elevation foundations"
      description="Elevation encodes distance from the canvas, and the product has two distances: a surface that sits in the flow, and one that is detached and dismissible."
      note="Neither draws a border: both tokens already contain a 1px ring and, in dark, a top inset highlight."
      noteAside="Utilities: shadow-raised, shadow-overlay, shadow-inset, from src/index.css. Inset tokens: --inset-highlight, --inset-rim."
    >
      <FoundationSection
        label="Raised — in the flow"
        description="App frame, card, list panel, settings container, table head. The bleed stays short on purpose: a tile in a grid inside a scroller is clipped by that scroller, and a shadow reaching past the tile's clearance is sliced into a hard line along the container edge."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="shadow-raised" note="raisedSurfaceStyle — the class pair components share">
            <div className="flex h-32 flex-col justify-end rounded-xl bg-card p-4 shadow-raised">
              <Txt variant="label">Raised surface</Txt>
              <Txt variant="caption" tone="muted">
                Rim and drop from one token
              </Txt>
            </div>
          </Specimen>
          <Specimen name="Tiles in a grid" note="Short bleed, so neighbours and the container edge stay clean">
            <div className="grid h-32 grid-cols-2 gap-2 overflow-hidden rounded-xl bg-background p-2">
              {['Tile', 'Tile'].map((label, index) => (
                <div key={index} className="rounded-lg bg-card p-3 shadow-raised">
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
            <div className="flex h-32 flex-col justify-end rounded-xl bg-card p-4 shadow-overlay">
              <Txt variant="label">Overlay surface</Txt>
              <Txt variant="caption" tone="muted">
                Same rim, longer falloff
              </Txt>
            </div>
          </Specimen>
          <Specimen name="Over content" note="A nested surface keeps the recipe, never a second border">
            <div className="flex h-32 items-center justify-center rounded-xl bg-background p-4">
              <div className="w-full rounded-lg bg-card p-3 shadow-overlay">
                <Txt variant="caption" tone="muted">
                  Reads as lifted off the surface beneath it.
                </Txt>
              </div>
            </div>
          </Specimen>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Inset — on the surface"
        description="Badges and product avatars sit on a surface rather than above it, so they carry no drop. shadow-inset gives them a 1px top highlight from --inset-highlight and a 1px rim from --inset-rim. Both are neutral: the fill carries the color, never the edge."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="shadow-inset" note="Badge and ProductAvatar">
            <div className="flex h-20 flex-wrap items-center gap-3 rounded-xl bg-background p-4">
              <ProductAvatar product="studio" />
              <ProductBadge product="studio" />
              <Badge variant="purple">Purple</Badge>
              <Badge variant="success">Success</Badge>
            </div>
          </Specimen>
          <Specimen
            name="--inset-highlight / --inset-rim"
            note="Dark: white at 7% / 7%. Light: white at 55% / black at 8%."
          >
            <div className="flex h-20 items-center gap-3 rounded-xl bg-background p-4">
              <div className="size-12 rounded-lg bg-card shadow-inset" />
              <Txt variant="caption" tone="muted">
                The inset edge alone, on a neutral fill
              </Txt>
            </div>
          </Specimen>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Not elevation"
        description="The focus halo is the only other box-shadow in the system. It belongs to focus, not to depth — it is documented on the Surface page beside --border-focus and --ring."
      >
        <Specimen name="--shadow-focus-ring" note="Paired with ring-border-focus by focusRing.visible">
          <div className="flex h-20 items-center justify-center rounded-xl bg-background p-4">
            <div className="rounded-md bg-fill px-3 py-1.5 shadow-focus-ring ring-1 ring-border-focus">
              <Txt variant="label">Focused row</Txt>
            </div>
          </div>
        </Specimen>
      </FoundationSection>
    </FoundationPage>
  ),
};
