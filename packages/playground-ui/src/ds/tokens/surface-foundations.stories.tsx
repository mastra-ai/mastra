import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { BorderColors, Colors } from './colors';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Surface',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three ladders cover everything that sits above a surface: a fill for the body of a control, a 1px boundary for its edge, and an opaque set for a control that is a colour of its own. The first two are alphas of the foreground, so a rung is a relative step and reads the same on the sidebar, the canvas and a card; the third cannot be, because a filled control has to cover what it sits on.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type FillToken = keyof typeof Colors;
type BoundaryToken = keyof typeof BorderColors;

const fillLadder: { token: FillToken; use: string }[] = [
  { token: 'fill-subtle', use: 'Ghost hover, row hover, disabled' },
  { token: 'fill', use: 'Rest of a filled control' },
  { token: 'fill-hover', use: 'Hover; rest of a selection control' },
  { token: 'fill-active', use: 'Press, open, selected' },
  { token: 'fill-strong', use: 'Selection-control press' },
];

const filledInverseLadder: { token: FillToken; use: string }[] = [
  { token: 'fill-inverse', use: 'Rest of a primary button' },
  { token: 'fill-inverse-hover', use: 'Hover' },
  { token: 'fill-inverse-active', use: 'Press' },
  { token: 'fill-inverse-disabled', use: 'Disabled' },
];

const filledDestructiveLadder: { token: FillToken; use: string }[] = [
  { token: 'fill-destructive', use: 'Rest of a destructive button' },
  { token: 'fill-destructive-hover', use: 'Hover' },
  { token: 'fill-destructive-active', use: 'Press' },
  { token: 'fill-destructive-disabled', use: 'Disabled' },
];

const boundaryLadder: { token: BoundaryToken; use: string }[] = [
  { token: 'border', use: 'Rim of a filled control, divider' },
  { token: 'border-strong', use: 'Edge of a transparent control at rest' },
  { token: 'border-hover', use: 'Hover on either of those' },
  { token: 'border-focus', use: 'Focus, at 3:1 against its fill' },
];

const overlayWashes: { token: FillToken; use: string }[] = [
  { token: 'surface-overlay-soft', use: 'A hovered row inside a popover' },
  { token: 'surface-overlay-strong', use: 'The selected one, and a menu separator band' },
];

const rimTokens = ['--surface-rim', '--surface-rim-focus'];
const tintTokens = ['--fill-tint'];

const tintValues = [
  { theme: 'Dark', value: '100%', use: 'Light catching a dark surface' },
  { theme: 'Light', value: '20.5%', use: 'Shade landing on a light one' },
];

const FillLadderRow = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
    {fillLadder.map(rung => (
      <Specimen key={rung.token} name={`--${rung.token}`} note={rung.use}>
        <div role="img" aria-label={`${rung.token} fill`} className="h-16" style={{ background: Colors[rung.token] }} />
      </Specimen>
    ))}
  </div>
);

// Each rung is drawn over a word: a filled control that stays filled is the whole
// point of this ladder, so anything legible through a swatch is a bug in the token.
const FilledLadderRow = ({ ladder }: { ladder: { token: FillToken; use: string }[] }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {ladder.map(rung => (
      <Specimen key={rung.token} name={`--${rung.token}`} note={rung.use}>
        <div className="relative h-16 overflow-hidden rounded-md">
          <Txt variant="body-sm" className="absolute inset-0 flex items-center justify-center">
            Behind
          </Txt>
          <div
            role="img"
            aria-label={`${rung.token} fill`}
            className="absolute inset-0"
            style={{ background: Colors[rung.token] }}
          />
        </div>
      </Specimen>
    ))}
  </div>
);

const BoundaryLadderRow = ({ filled }: { filled: boolean }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {boundaryLadder.map(rung => (
      <Specimen key={rung.token} name={`--${rung.token}`} note={filled ? undefined : rung.use}>
        <div
          role="img"
          aria-label={`${rung.token} edge`}
          className="h-14 rounded-md border"
          style={{ borderColor: BorderColors[rung.token], background: filled ? Colors.fill : 'transparent' }}
        />
      </Specimen>
    ))}
  </div>
);

export const SurfaceFoundations: Story = {
  name: 'Surface foundations',
  render: (_args, context) => (
    <FoundationPage
      eyebrow={`Surface / ${fillLadder.length + filledInverseLadder.length + filledDestructiveLadder.length + boundaryLadder.length + overlayWashes.length + rimTokens.length + tintTokens.length + 3} tokens`}
      title="Surface foundations"
      description="A fill is the body of anything raised above its parent surface; a boundary is its 1px edge. Those rungs are alphas, so the same rung holds on any surface — read both ladders twice below, once on the canvas and once on the sidebar. The opaque ladder is the exception, and is shown once: a control that carries its own colour must read the same everywhere by covering what is under it."
      aside={
        <Txt variant="meta" font="mono" tone="muted" className="uppercase">
          Mode / {context.globals.theme === 'light' ? 'Light' : 'Dark'}
        </Txt>
      }
      note="Light uses its own, much shallower alphas — a lightness step has to be large on near-black and small on near-white."
      noteAside="Utilities: bg-fill-*, border-border-*."
    >
      <FoundationSection
        label="Fill ladder"
        description="One language for anything sitting above its parent surface, from a state layer to a pressed selection control."
      >
        <SpecimenGroup label="On the canvas">
          <FillLadderRow />
        </SpecimenGroup>
        <SpecimenGroup label="Inside a sidebar card">
          <div className="bg-sidebar rounded-lg p-4">
            <FillLadderRow />
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Opaque ladder"
        description="The states of a control that is a colour rather than a rung on the surface — the primary and destructive buttons. An alpha here would open a window onto the card text, row or image the control covers, widening with every louder state, so each rung is the opaque twin of the alpha it replaces: the same colour mixed toward --background by the same amount."
      >
        <SpecimenGroup label="Inverse — primary">
          <FilledLadderRow ladder={filledInverseLadder} />
        </SpecimenGroup>
        <SpecimenGroup label="Destructive">
          <FilledLadderRow ladder={filledDestructiveLadder} />
        </SpecimenGroup>
        <Txt variant="caption" tone="muted">
          The word behind each swatch never shows. Mixing happens in sRGB, the space a browser composites alpha in, so a
          rung lands on the exact colour its translucent predecessor painted over the canvas — same paint, no window.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Panel"
        description="The opaque twin of --fill, for a scrolling panel whose sticky parts cannot let rows show through."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-160">
          <Specimen name="--surface-panel" note="Opaque — sticky headers, floating panels">
            <div className="bg-surface-panel h-20 rounded-md" />
          </Specimen>
          <Specimen name="--fill" note="Translucent — the control beside it">
            <div className="bg-fill h-20 rounded-md" />
          </Specimen>
        </div>
        <Txt variant="caption" tone="muted">
          Side by side on the canvas the two must read as one material; if they drift apart, the panel is wrong.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Overlay wash"
        description="Row states inside a popover. The fill ladder cannot serve here — a rung tuned to read above the canvas disappears on a surface that is itself lifted."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SpecimenGroup label="The two washes, on a popover">
            <div className="bg-popover shadow-overlay grid grid-cols-2 gap-3 rounded-xl p-3">
              {overlayWashes.map(wash => (
                <Specimen key={wash.token} name={`--${wash.token}`} note={wash.use}>
                  <div
                    role="img"
                    aria-label={`${wash.token} wash`}
                    className="h-16 rounded-md"
                    style={{ background: Colors[wash.token] }}
                  />
                </Specimen>
              ))}
            </div>
          </SpecimenGroup>
          <SpecimenGroup label="In a menu">
            <div className="bg-popover shadow-overlay flex flex-col rounded-xl p-1">
              <Txt variant="body-sm" className="rounded-md px-3 py-1.5">
                Rest
              </Txt>
              <Txt variant="body-sm" className="bg-surface-overlay-soft rounded-md px-3 py-1.5">
                Hovered
              </Txt>
              <Txt variant="body-sm" className="bg-surface-overlay-strong rounded-md px-3 py-1.5">
                Selected
              </Txt>
            </div>
          </SpecimenGroup>
        </div>
        <Txt variant="caption" tone="muted">
          These two alias the gray-alpha ramp rather than the tint: --surface-overlay-soft is --fill-subtle,
          --surface-overlay-strong is --gray-alpha-2.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Scrim"
        description="The one wash that dims instead of lifting: it sits under a dialog or drawer and puts the app out of reach. The alpha is the whole token — black at 75% in dark, a near-black shade at 45% in light — so what is behind stays readable and unmistakably inert."
      >
        <SpecimenGroup label="A dialog over the canvas">
          <Specimen name="--scrim" note="Backdrop of a dialog, drawer or command palette">
            <div className="border-border relative overflow-hidden rounded-xl border">
              <div className="bg-background flex flex-col gap-2 p-6">
                <Txt variant="body-sm">The page behind</Txt>
                <Txt variant="caption" tone="muted">
                  Still visible, no longer reachable.
                </Txt>
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: Colors.scrim }}>
                <div className="bg-popover shadow-overlay rounded-xl px-6 py-4">
                  <Txt variant="body-sm">Dialog</Txt>
                </div>
              </div>
            </div>
          </Specimen>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Boundary ladder"
        description="The four states of a control's 1px edge, shown on a filled body and on a transparent one."
      >
        <SpecimenGroup label="Transparent, on the canvas">
          <BoundaryLadderRow filled={false} />
        </SpecimenGroup>
        <SpecimenGroup label="Filled with --fill, on the canvas">
          <BoundaryLadderRow filled />
        </SpecimenGroup>
        <SpecimenGroup label="Inside a sidebar card">
          <div className="bg-sidebar flex flex-col gap-3 rounded-lg p-4">
            <BoundaryLadderRow filled={false} />
            <BoundaryLadderRow filled />
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Rim"
        description="The 1px inset edge shadow-raised draws, and the one edge focus moves on a field."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-160">
          <Specimen name="--surface-rim" note="Rest — every raised and overlay surface">
            <div className="bg-card shadow-raised h-20 rounded-md" />
          </Specimen>
          <Specimen name="--surface-rim-focus" note="Focus — the same edge, never a second line beside it">
            <div className="bg-card shadow-raised h-20 rounded-md [--surface-rim:var(--surface-rim-focus)]" />
          </Specimen>
        </div>
        <Txt variant="caption" tone="muted">
          It is not --border. A divider has the whole surface behind it and needs that weight; the rim sits on the
          boundary between two surfaces that already differ in fill and elevation, so the same alpha overshoots and the
          surface reads as framed. Hover leaves it alone — the rim is the loudest part of a borderless surface, so a
          pointer wash goes through --surface-tint instead.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Focus"
        description="Two focus languages, on purpose. A field takes the neutral edge — no accent — so a focused input does not read as a status. A row, link or tab takes the accent ring plus its halo, because there is no field edge to move."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-44">
            <Specimen name="--ring" note="Alias of --border-focus">
              <div role="img" aria-label="ring token" className="h-14 rounded-md" style={{ background: Colors.ring }} />
            </Specimen>
          </div>
          <div className="w-44">
            <Specimen name="ring-1 ring-ring" note="Drawn outside the fill">
              <div className="bg-fill ring-ring h-14 rounded-md ring-1" />
            </Specimen>
          </div>
          <div className="w-44">
            <Specimen name="--shadow-focus-ring" note="focusRing.visible — row, link, tab">
              <div className="bg-fill shadow-focus-ring ring-accent1 h-14 rounded-md ring-1" />
            </Specimen>
          </div>
        </div>
      </FoundationSection>

      <FoundationSection
        label="Tint"
        description="One value per theme, and the whole light/dark flip. Every rung of both ladders above is an alpha of it."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-160">
          {tintValues.map(tint => (
            <Specimen key={tint.theme} name={`--fill-tint: ${tint.value}`} note={`${tint.theme} — ${tint.use}`}>
              <div className="bg-card h-20 rounded-md p-3">
                <div
                  role="img"
                  aria-label={`${tint.theme} tint at the --fill-hover alpha`}
                  className="h-full rounded-sm"
                  style={{ background: `oklch(${tint.value} 0 0 / 9%)` }}
                />
              </div>
            </Specimen>
          ))}
        </div>
        <Txt variant="caption" tone="muted">
          Both swatches are --fill-hover's 9%, drawn on the same card: only the tint changes, and only one of the two
          belongs to the theme you are reading. A theme switch re-resolves nine tokens by moving this one — 100% in
          dark, 20.5% in light. Alpha compositing is linear in sRGB, which is what lets a single alpha be a single step
          in both directions: white over near-black spans 242 levels, near-black over near-white 233. Nothing reads it
          directly; it exists so nothing else is authored twice.
        </Txt>
      </FoundationSection>
    </FoundationPage>
  ),
};
