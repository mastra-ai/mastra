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
  { token: 'fill-destructive-disabled-foreground', use: 'Text on a disabled destructive fill' },
];

const fieldSurfaceTokens = [
  { token: 'field-on-surface', use: 'Field fill inside a raised surface' },
  { token: 'field-rim', use: 'Field edge on the canvas' },
  { token: 'field-rim-focus', use: 'Focused field edge' },
  { token: 'field-rim-on-surface', use: 'Field edge inside a raised surface' },
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

const tintValues = [
  { theme: 'Dark', value: '100%', use: 'Light catching a dark surface' },
  { theme: 'Light', value: '20.5%', use: 'Shade landing on a light one' },
];

const FillLadderRow = ({ onSidebar = false }: { onSidebar?: boolean }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
    {fillLadder.map(rung => (
      <Specimen key={rung.token} name={onSidebar ? `Sidebar / --${rung.token}` : `--${rung.token}`} note={rung.use}>
        <div role="img" aria-label={`${rung.token} fill`} className="h-16" style={{ background: Colors[rung.token] }} />
      </Specimen>
    ))}
  </div>
);

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

const BoundaryLadderRow = ({ filled, onSidebar = false }: { filled: boolean; onSidebar?: boolean }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {boundaryLadder.map(rung => (
      <Specimen
        key={rung.token}
        name={filled || onSidebar ? `${onSidebar ? 'Sidebar' : 'Filled'} / --${rung.token}` : `--${rung.token}`}
        note={filled ? undefined : rung.use}
      >
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
      eyebrow="Surface"
      title="Surface foundations"
      description="A fill is the body of anything raised above its parent surface; a boundary is its 1px edge. Those rungs are alphas, so the same rung holds on any surface — read both ladders twice below, once on the canvas and once on the sidebar. The opaque ladder is the exception, and is shown once: a control that carries its own colour must read the same everywhere by covering what is under it."
      aside={
        <Txt variant="meta" font="mono" tone="muted" className="uppercase">
          Mode / {context.globals.theme === 'light' ? 'Light' : 'Dark'}
        </Txt>
      }
      note="The fill and boundary ladders share their alphas across themes, except focus. Light mode changes the tint; surface and field rims have their own theme values."
      noteAside="Utilities: bg-fill-*, border-border-*, border-surface-rim."
    >
      <FoundationSection
        label="Fill ladder"
        description="One language for anything sitting above its parent surface, from a state layer to a pressed selection control."
      >
        <SpecimenGroup label="On the canvas">
          <FillLadderRow />
        </SpecimenGroup>
        <SpecimenGroup label="Inside a sidebar card">
          <div className="rounded-lg bg-sidebar p-4">
            <FillLadderRow onSidebar />
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Opaque ladder"
        description="The states of a control that is a colour rather than a rung on the surface — the primary and destructive buttons. An alpha here would open a window onto the card text, row or image the control covers, so every rung is opaque. The inverse rungs mix --foreground toward --background; the destructive rungs step down the red ramp in both themes so the red-50 label stays legible."
      >
        <SpecimenGroup label="Inverse — primary">
          <FilledLadderRow ladder={filledInverseLadder} />
        </SpecimenGroup>
        <SpecimenGroup label="Destructive">
          <FilledLadderRow ladder={filledDestructiveLadder} />
        </SpecimenGroup>
        <div className="max-w-40">
          <Specimen name="--fill-destructive-foreground" note="Text on every destructive fill">
            <div
              role="img"
              aria-label="Destructive foreground"
              className="h-16 border border-border"
              style={{ background: Colors['fill-destructive-foreground'] }}
            />
          </Specimen>
        </div>
        <Txt variant="caption" tone="muted">
          The word behind each swatch never shows. Inverse rungs mix in sRGB, the space a browser composites alpha in,
          so each lands on the exact colour its translucent predecessor painted over the canvas — same paint, no window.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Field on a surface"
        description="Fields change fill and edge with their parent surface; focus repaints that edge."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fieldSurfaceTokens.map(({ token, use }) => (
            <Specimen key={token} name={`--${token}`} note={use}>
              <div
                role="img"
                aria-label={`--${token} ${token === 'field-on-surface' ? 'fill' : 'edge'}`}
                className={token === 'field-on-surface' ? 'h-16 rounded-md' : 'h-16 rounded-md border'}
                style={
                  token === 'field-on-surface' ? { background: `var(--${token})` } : { borderColor: `var(--${token})` }
                }
              />
            </Specimen>
          ))}
        </div>
      </FoundationSection>

      <FoundationSection
        label="Panel"
        description="The opaque twin of --fill, for a scrolling panel whose sticky parts cannot let rows show through."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-160">
          <Specimen name="--surface-panel" note="Opaque — sticky headers, floating panels">
            <div className="h-20 rounded-md bg-surface-panel" />
          </Specimen>
          <Specimen name="Translucent comparison" note="--fill — the control beside it">
            <div className="h-20 rounded-md bg-fill" />
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
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-popover p-3 shadow-overlay">
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
            <div className="flex flex-col rounded-xl bg-popover p-1 shadow-overlay">
              <Txt variant="body-sm" className="rounded-md px-3 py-1.5">
                Rest
              </Txt>
              <Txt variant="body-sm" className="rounded-md bg-surface-overlay-soft px-3 py-1.5">
                Hovered
              </Txt>
              <Txt variant="body-sm" className="rounded-md bg-surface-overlay-strong px-3 py-1.5">
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
            <div className="relative overflow-hidden rounded-xl border border-border">
              <div className="flex flex-col gap-2 bg-background p-6">
                <Txt variant="body-sm">The page behind</Txt>
                <Txt variant="caption" tone="muted">
                  Still visible, no longer reachable.
                </Txt>
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: Colors.scrim }}>
                <div className="rounded-xl bg-popover px-6 py-4 shadow-overlay">
                  <Txt variant="body-sm">Dialog</Txt>
                </div>
              </div>
            </div>
          </Specimen>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Boundary ladder"
        description="Content dividers and control edges, shown at their authored opacity. Use border-border for dividers, border-border-strong for outlined controls, and the hover/focus roles for their states."
      >
        <SpecimenGroup label="Transparent, on the canvas">
          <BoundaryLadderRow filled={false} />
        </SpecimenGroup>
        <SpecimenGroup label="Filled with --fill, on the canvas">
          <BoundaryLadderRow filled />
        </SpecimenGroup>
        <SpecimenGroup label="Inside a sidebar card">
          <div className="flex flex-col gap-3 rounded-lg bg-sidebar p-4">
            <BoundaryLadderRow filled={false} onSidebar />
            <BoundaryLadderRow filled onSidebar />
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Rim"
        description="The shared edge for app frames, cards and panels. border-surface-rim and shadow-rim use the same token. Raised and overlay recipes compose it with other effects."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Specimen name="--surface-rim" note="border-surface-rim — isolated 1px edge">
            <div role="img" aria-label="surface-rim edge" className="h-20 rounded-md border border-surface-rim" />
          </Specimen>
          <Specimen name="Inset rim only" note="shadow-rim — same color, inside the box">
            <div role="img" aria-label="surface-rim inset edge" className="h-20 rounded-md shadow-rim" />
          </Specimen>
          <Specimen name="Raised composition" note="Card fill + lip + rim + drops">
            <div className="h-20 rounded-md bg-card shadow-raised" />
          </Specimen>
          <Specimen name="Focused rim comparison" note="Raised composition with --border-focus replacing its rim">
            <div className="h-20 rounded-md bg-card shadow-raised [--surface-rim:var(--border-focus)]" />
          </Specimen>
        </div>
        <Txt variant="caption" tone="muted">
          Surface rims and content dividers serve different roles. A frame header uses the surface rim to match the edge
          it meets; internal separators use --border. Use each token at its authored opacity. Reserve 1px inside an
          inset frame so a child divider cannot paint over its rim. A surface recipe already draws that rim, so it needs
          no extra border on the same edge.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Focus"
        description="Neutral and never a halo. A field or raised surface repaints its own edge to its focus rim. Anything without an edge — a row, link, tab or small control — takes a 1px --border-focus outline: flush, inset where the edge is clipped, or offset where it would vanish into a solid fill."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div className="w-44">
            <Specimen name="focusRing" note="Row, link, tab">
              <div className="h-14 rounded-md bg-fill outline-1 outline-border-focus" />
            </Specimen>
          </div>
          <div className="w-44">
            <Specimen name="focusRingInset" note="Full-bleed row whose outer edge is clipped">
              <div className="h-14 rounded-md bg-fill outline-1 -outline-offset-1 outline-border-focus" />
            </Specimen>
          </div>
          <div className="w-44">
            <Specimen name="focusRingOffset" note="Checkbox, radio, switch">
              <div className="h-14 rounded-md bg-foreground outline-1 outline-offset-2 outline-border-focus" />
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
              <div className="h-20 rounded-md bg-card p-3">
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
