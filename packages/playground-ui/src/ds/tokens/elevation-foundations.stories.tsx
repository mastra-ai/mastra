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
          'shadow-rim draws only the surface edge. shadow-raised and shadow-overlay compose that edge with a lip and drops; shadow-inset combines a highlight and rim for badges and avatars. The examples distinguish isolated edges from these complete recipes.',
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
      eyebrow="Elevation / 4 utilities"
      title="Elevation foundations"
      description="Elevation encodes distance from the canvas, and the product has two distances: a surface that sits in the flow, and one that is detached and dismissible."
      note="Each recipe already draws its edge. Adding a CSS border on that same edge doubles it."
      noteAside="Utilities: shadow-rim, shadow-raised, shadow-overlay, shadow-inset."
    >
      <FoundationSection
        label="Rim — edge only"
        description="shadow-rim draws a 1px inset --surface-rim with no highlight or drop. border-surface-rim uses the same color as a CSS border. Reserve the inset pixel when children touch this edge."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="shadow-rim" note="Isolated inset edge on the canvas">
            <div className="h-20 rounded-xl shadow-rim" />
          </Specimen>
          <Specimen name="border-surface-rim" note="Isolated CSS border on the same canvas">
            <div className="h-20 rounded-xl border border-surface-rim" />
          </Specimen>
        </div>
      </FoundationSection>
      <FoundationSection
        label="Raised — in the flow"
        description="App frame, card, list panel, settings container, table head. The bleed stays short on purpose: a tile in a grid inside a scroller is clipped by that scroller, and a shadow reaching past the tile's clearance is sliced into a hard line along the container edge."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Specimen name="shadow-raised" note="raisedSurfaceStyle — the class pair components share">
            <div className="flex h-32 flex-col justify-end rounded-xl bg-card p-4 shadow-raised">
              <Txt variant="label">Raised surface</Txt>
              <Txt variant="caption" tone="muted">
                Lip + surface rim + drops
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
          <Specimen name="Inset edge" note="Dark: white at 7% / 7%. Light: white at 55% / black at 8%.">
            <div className="flex h-20 items-center gap-3 rounded-xl bg-background p-4">
              <div className="size-12 rounded-lg bg-card shadow-inset" />
              <Txt variant="caption" tone="muted">
                The inset edge alone, on a neutral fill
              </Txt>
            </div>
          </Specimen>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-80">
          {['inset-highlight', 'inset-rim'].map(token => (
            <Specimen key={token} name={`--${token}`}>
              <div
                role="img"
                aria-label={`--${token} isolated edge`}
                className="h-16 rounded-md"
                style={{
                  boxShadow:
                    token === 'inset-highlight' ? `inset 0 1px 0 var(--${token})` : `inset 0 0 0 1px var(--${token})`,
                }}
              />
            </Specimen>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
