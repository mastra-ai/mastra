import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Txt } from '../components/Txt/Txt';
import { ARRIVING_CLASS, ARRIVING_MS } from './animations';
import { FoundationPage, FoundationSection, Specimen, SpecimenGroup } from './foundations-layout';
import { cn } from '@/lib/utils';
import '@/ds/components/Arrival/arrival.css';

const meta: Meta = {
  title: 'Foundations/Utilities',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The classes the design system ships beyond the colour, type and spacing scales: the interaction layer a surface wears, the radii the app frame and its panels share, the one transition allowed to move a box, and the five animations that mark something arriving, sorting or being clicked.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

interface UtilitySpecimen {
  tokens: string[];
  note: string;
  demo: ReactNode;
}

const DemoButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="state-layer border-border bg-card text-label text-foreground w-fit cursor-pointer rounded-md border px-2.5 py-1"
  >
    {children}
  </button>
);

const ResizeDemo = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-background h-16 rounded-md p-2">
        <div className={cn('t-resize h-full rounded-sm bg-fill-strong', expanded ? 'w-full' : 'w-1/4')} />
      </div>
      <DemoButton onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Expand'}</DemoButton>
    </div>
  );
};

const ReplaySpecimen = ({ tokens, note, demo }: UtilitySpecimen) => {
  const [run, setRun] = useState(0);

  return (
    <Specimen name={tokens.join(' + ')} note={note}>
      <div className="flex flex-col gap-2">
        <div key={run}>{demo}</div>
        <DemoButton onClick={() => setRun(run + 1)}>Play again</DemoButton>
      </div>
    </Specimen>
  );
};

const UtilityGrid = ({ specimens, children }: { specimens: UtilitySpecimen[]; children?: ReactNode }) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    {specimens.map(specimen => (
      <Specimen key={specimen.tokens[0]} name={specimen.tokens.join(' + ')} note={specimen.note}>
        {specimen.demo}
      </Specimen>
    ))}
    {children}
  </div>
);

const stateSpecimens: UtilitySpecimen[] = [
  {
    tokens: ['state-layer'],
    note: 'Hover: the rung lands on top of the fill, never in it',
    demo: (
      <div className="state-layer bg-card shadow-raised flex h-24 items-center justify-center rounded-lg">
        <Txt variant="label">Reach for this one</Txt>
      </div>
    ),
  },
  {
    tokens: ['--surface-tint'],
    note: 'Hover and focus: the same rung, on a control with no ::before',
    demo: (
      <div className="flex h-24 items-center">
        <input
          aria-label="Filter runs"
          placeholder="Filter runs"
          className="bg-card text-body text-foreground shadow-raised placeholder:text-placeholder h-8 w-full rounded-full px-3 outline-hidden focus-visible:[--surface-rim:var(--surface-rim-focus)] [&:hover:not(:focus-visible)]:[--surface-tint:var(--fill-subtle)]"
        />
      </div>
    ),
  },
];

const frameSpecimens: UtilitySpecimen[] = [
  {
    tokens: ['rounded-studio-frame', '--studio-frame-radius'],
    note: 'Default 1.5rem, then overridden to 2.5rem',
    demo: (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-studio-frame border-border-strong bg-fill h-24 border" />
        <div className="rounded-studio-frame border-border-strong bg-fill h-24 border [--studio-frame-radius:2.5rem]" />
      </div>
    ),
  },
  {
    tokens: ['rounded-studio-panel', '--studio-frame-inset'],
    note: 'Inset by 0.5rem, then 1rem: frame radius minus inset',
    demo: (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-studio-frame border-border-strong bg-fill h-24 border p-2">
          <div className="rounded-studio-panel bg-card h-full" />
        </div>
        <div className="rounded-studio-frame border-border-strong bg-fill h-24 border p-4 [--studio-frame-inset:1rem]">
          <div className="rounded-studio-panel bg-card h-full" />
        </div>
      </div>
    ),
  },
  {
    tokens: ['rounded-tr-studio-panel'],
    note: 'Only the exposed corner curves; the rest sits flush',
    demo: (
      <div className="rounded-studio-frame border-border-strong bg-fill h-24 overflow-hidden border p-2 pb-0 pl-0">
        <div className="rounded-tr-studio-panel bg-card h-full" />
      </div>
    ),
  },
];

const resizeSpecimens: UtilitySpecimen[] = [
  {
    tokens: ['t-resize', '--resize-dur', '--resize-ease'],
    note: 'Sidebar collapse and expand, over 300ms',
    demo: <ResizeDemo />,
  },
];

const animationSpecimens: UtilitySpecimen[] = [
  {
    tokens: ['animate-row-highlight'],
    note: 'A row that landed unseen: tinted, then 2s to nothing',
    demo: (
      <div className="bg-background rounded-md p-1">
        <div className="animate-row-highlight text-body-sm text-foreground flex h-10 items-center rounded-sm px-3">
          GET /api/agents
        </div>
      </div>
    ),
  },
  {
    tokens: ['animate-sort-arrow-up'],
    note: 'Ascending: drawn from the bottom up, the way it points',
    demo: (
      <div className="bg-background flex h-16 items-center justify-center rounded-md">
        <ArrowUp className="animate-sort-arrow-up size-icon-lg text-foreground" />
      </div>
    ),
  },
  {
    tokens: ['animate-sort-arrow-down'],
    note: 'Descending: the same reveal, top down',
    demo: (
      <div className="bg-background flex h-16 items-center justify-center rounded-md">
        <ArrowDown className="animate-sort-arrow-down size-icon-lg text-foreground" />
      </div>
    ),
  },
  {
    tokens: ['animate-click-ripple'],
    note: 'Where a click landed in a remote browser view',
    demo: (
      <div className="bg-background relative flex h-16 items-center justify-center overflow-hidden rounded-md">
        <span className="animate-click-ripple bg-accent1/40 pointer-events-none size-12 rounded-full" />
      </div>
    ),
  },
  {
    tokens: [ARRIVING_CLASS],
    note: `A streamed word, a tool row: opacity over ${ARRIVING_MS}ms`,
    demo: (
      <div className="bg-background flex h-16 items-center rounded-md px-3">
        <Txt variant="body-sm" className={ARRIVING_CLASS}>
          Ran tool search_docs — 412ms
        </Txt>
      </div>
    ),
  },
];

const wrappingSpecimens: UtilitySpecimen[] = [
  {
    tokens: ['wrap-break-word'],
    note: 'Breaks an id mid-word rather than widening its column',
    demo: (
      <div className="bg-background grid grid-cols-2 gap-3 rounded-md p-3">
        <div className="text-body-sm text-foreground font-mono wrap-break-word">
          trace_01JQX8S9Z7KQ4M2VYB3NCE6WHD_span_0f3a9c1b7e2d
        </div>
        <div className="text-body-sm text-muted-foreground overflow-hidden font-mono">
          trace_01JQX8S9Z7KQ4M2VYB3NCE6WHD_span_0f3a9c1b7e2d
        </div>
      </div>
    ),
  },
];

const documentedSpecimens = [
  ...stateSpecimens,
  ...frameSpecimens,
  ...resizeSpecimens,
  ...animationSpecimens,
  ...wrappingSpecimens,
];
const tokenCount = documentedSpecimens.flatMap(specimen => specimen.tokens).length;

export const UtilitiesFoundations: Story = {
  name: 'Utilities foundations',
  render: () => (
    <FoundationPage
      eyebrow={`Utilities / ${tokenCount} tokens`}
      title="Utilities foundations"
      description="These are the classes that carry a decision rather than a value. Each one exists because the obvious Tailwind spelling of the same idea breaks in one theme, on one surface, or under a scroller."
      note="Every animation and transition on this page stops under prefers-reduced-motion."
      noteAside="Declared in src/index.css, theme.css and ds/components/Arrival/arrival.css."
    >
      <FoundationSection
        label="Interaction layer"
        description="A surface that already has an opaque fill cannot hover by swapping its background. Hover the three below, then switch themes."
      >
        <UtilityGrid specimens={stateSpecimens}>
          <Specimen
            name="hover:bg-fill-subtle"
            note="The obvious spelling — and it moves the wrong way in one of the two themes"
          >
            <div className="bg-card shadow-raised hover:bg-fill-subtle flex h-24 items-center justify-center rounded-lg">
              <Txt variant="label" tone="muted">
                Not this one
              </Txt>
            </div>
          </Specimen>
        </UtilityGrid>
        <Txt variant="caption" tone="muted">
          A translucent rung put in background-color replaces the fill, so it composites over the page instead of over
          the surface. On bg-muted that lands 3 levels darker in dark and 5 lighter in light: the same class inverts.
          Layered on top, the rung is +9/-9 from whatever it sits on, in both themes, whatever the resting fill.
        </Txt>
        <Txt variant="caption" tone="muted">
          --surface-tint is the mechanism those utilities share, not a colour to reach for: shadow-raised,
          shadow-overlay and state-layer each reset it to transparent, because a custom property would otherwise inherit
          into every raised surface nested inside a hovered one. Set it through a variant on the element itself, the way
          a field does.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Frame radius"
        description="One property curves the app frame and everything inside it, so a panel never hardcodes a radius that drifts from the frame holding it."
      >
        <UtilityGrid specimens={frameSpecimens} />
        <Txt variant="caption" tone="muted">
          --studio-frame-radius defaults to 1.5rem and --studio-frame-inset to 0.5rem. A panel's radius is the
          difference between the two, floored at 0, which is what keeps the two curves concentric when a container
          changes either one.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Resize"
        description="The Motion page states the shell only animates colour. This is the documented exception."
      >
        <UtilityGrid specimens={resizeSpecimens} />
        <Txt variant="caption" tone="muted">
          The sidebar changes its own width, and a width that jumps reads as a layout bug rather than a panel opening.
          The class is scoped to that one case — width and height, on an element that owns its size — and it is the only
          thing in the system allowed to animate geometry. A pointer-driven drag opts out, so a gesture stays in the
          hand.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Animations"
        description="Five one-shot animations, each marking a change the reader would otherwise have to hunt for. None of them loops, and none of them is a loading state."
      >
        <SpecimenGroup label="Press Play again to replay any of them">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {animationSpecimens.map(specimen => (
              <ReplaySpecimen key={specimen.tokens[0]} {...specimen} />
            ))}
          </div>
        </SpecimenGroup>
      </FoundationSection>

      <FoundationSection
        label="Wrapping"
        description="One utility, for text the product does not control: a log line, an identifier, an error from somewhere else."
      >
        <UtilityGrid specimens={wrappingSpecimens} />
      </FoundationSection>
    </FoundationPage>
  ),
};
