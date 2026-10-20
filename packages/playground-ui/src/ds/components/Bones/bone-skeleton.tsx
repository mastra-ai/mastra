import {
  BoneSuspense as BoneyardSuspense,
  Skeleton as BoneyardSkeleton,
  configureBoneyard,
  registerBones,
} from 'boneyard-js/react';
import type { ReactNode } from 'react';
import { bones } from '@/bones';

// Bones read the theme tokens directly, so `.dark` flips them with the rest of the UI. The
// highlight is `--fill-subtle` laid over `--muted`, the same band the ds `Skeleton` sweeps. Shimmer
// rather than boneyard's default pulse: pulse derives its second colour by parsing hex, which a
// `var()` defeats. Reduced motion is handled in components.css.
const boneColor = 'var(--muted)';
const boneHighlight = 'color-mix(in oklab, var(--muted), oklch(var(--fill-tint) 0 0) 4%)';

configureBoneyard({
  color: boneColor,
  darkColor: boneColor,
  shimmerColor: boneHighlight,
  darkShimmerColor: boneHighlight,
  animate: 'shimmer',
  speed: '2s',
});

// Registered here, in the module that defines the components, so any bundle that renders a bone
// also ships the bones — no side-effect-only import to keep alive through tree-shaking.
// The captured JSON is boneyard's own output, so it is the shape registerBones expects.
registerBones(bones as Parameters<typeof registerBones>[0]);

// Declared here rather than derived from boneyard's types: boneyard-js is bundled, not a
// dependency, so consumers don't have it and an inferred props type would leak an unresolvable
// `boneyard-js/react` import into the published declarations.
interface BoneProps {
  /** Bone name. It must have a committed `src/bones/<name>.bones.json`; `pnpm bones:capture` writes it. */
  name: string;
  className?: string;
  /** Rendered instead of the children while `bones:capture` snapshots the layout. */
  fixture?: ReactNode;
  /** Pick the captured breakpoint by container width (default) or viewport width. */
  select?: 'container' | 'viewport';
}

export interface BoneSkeletonProps extends BoneProps {
  loading: boolean;
  /** The real content, shown once loaded. Omit it for a skeleton that is only rendered while loading. */
  children?: ReactNode;
  /** Announced to assistive tech while loading, e.g. "Loading traces". */
  label?: string;
}

/**
 * Shows the captured skeleton for `name` while `loading`, then the children. Wrap the real
 * component, and pass `fixture` content when the children need data that isn't there yet.
 */
export function BoneSkeleton({ label, loading, children = null, ...props }: BoneSkeletonProps) {
  return (
    <>
      <BoneyardSkeleton loading={loading} {...props}>
        {children}
      </BoneyardSkeleton>
      {/* Stays mounted so screen readers announce the label when loading starts after mount. */}
      {label ? (
        <span role="status" aria-label={loading ? label : undefined} className="sr-only">
          {loading ? label : null}
        </span>
      ) : null}
    </>
  );
}

export interface BoneSuspenseProps extends BoneProps {
  /** Components that suspend, e.g. via `useSuspenseQuery` or `React.lazy`. */
  children: ReactNode;
}

/** Suspense boundary whose fallback is the captured skeleton for `name`. */
export function BoneSuspense(props: BoneSuspenseProps) {
  return <BoneyardSuspense {...props} />;
}
