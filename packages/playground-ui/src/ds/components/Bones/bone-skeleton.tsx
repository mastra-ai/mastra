import {
  BoneSuspense as BoneyardSuspense,
  Skeleton as BoneyardSkeleton,
  configureBoneyard,
  registerBones,
} from 'boneyard-js/react';
import type { ComponentProps, ReactNode } from 'react';
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
registerBones(bones);

type BoneyardSkeletonProps = ComponentProps<typeof BoneyardSkeleton>;

export interface BoneSkeletonProps extends Omit<
  BoneyardSkeletonProps,
  'name' | 'children' | 'color' | 'darkColor' | 'animate'
> {
  /** Bone name. It must have a committed `src/bones/<name>.bones.json`; `pnpm bones:capture` writes it. */
  name: string;
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

export interface BoneSuspenseProps extends Omit<
  ComponentProps<typeof BoneyardSuspense>,
  'name' | 'color' | 'darkColor' | 'animate'
> {
  name: string;
}

/** Suspense boundary whose fallback is the captured skeleton for `name`. */
export function BoneSuspense(props: BoneSuspenseProps) {
  return <BoneyardSuspense {...props} />;
}
