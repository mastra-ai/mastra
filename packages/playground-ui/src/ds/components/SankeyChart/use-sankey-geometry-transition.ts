import { useEffect, useState } from 'react';

import type { FixedSankeyGeometry, FixedSankeyLinkGeometry, FixedSankeyNodeGeometry } from './sankey-chart-utils';

const TRANSITION_DURATION_MS = 850;

type GeometryTransition = {
  from: FixedSankeyGeometry;
  to: FixedSankeyGeometry;
  progress: number;
};

type GeometryMotionState = {
  key?: string;
  geometry?: FixedSankeyGeometry;
  transition?: GeometryTransition;
};

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function interpolateNode(
  from: FixedSankeyNodeGeometry,
  to: FixedSankeyNodeGeometry,
  progress: number,
): FixedSankeyNodeGeometry {
  return {
    x: mix(from.x, to.x, progress),
    y: mix(from.y, to.y, progress),
    centerY: mix(from.centerY, to.centerY, progress),
    height: mix(from.height, to.height, progress),
  };
}

function interpolateLink(
  from: FixedSankeyLinkGeometry,
  to: FixedSankeyLinkGeometry,
  progress: number,
): FixedSankeyLinkGeometry {
  return {
    sourceX: mix(from.sourceX, to.sourceX, progress),
    targetX: mix(from.targetX, to.targetX, progress),
    sourceY: mix(from.sourceY, to.sourceY, progress),
    targetY: mix(from.targetY, to.targetY, progress),
    sourceWidth: mix(from.sourceWidth, to.sourceWidth, progress),
    targetWidth: mix(from.targetWidth, to.targetWidth, progress),
  };
}

/**
 * Preserves node identity while pairing replaced links by render order. That
 * synthetic pairing keeps every ribbon moving continuously through a reorder,
 * even though changing adjacency means the old and new links have different IDs.
 */
export function interpolateSankeyGeometry(
  from: FixedSankeyGeometry,
  to: FixedSankeyGeometry,
  progress: number,
): FixedSankeyGeometry {
  const previousLinks = [...from.links.values()];
  const nodes = new Map<string, FixedSankeyNodeGeometry>();
  const links = new Map<string, FixedSankeyLinkGeometry>();

  for (const [id, target] of to.nodes) {
    nodes.set(id, interpolateNode(from.nodes.get(id) ?? target, target, progress));
  }

  let linkIndex = 0;
  for (const [id, target] of to.links) {
    const syntheticSource = previousLinks[linkIndex % previousLinks.length];
    links.set(id, interpolateLink(from.links.get(id) ?? syntheticSource ?? target, target, progress));
    linkIndex += 1;
  }

  return { nodes, links };
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useSankeyGeometryTransition({
  geometry,
  transitionKey,
}: {
  geometry?: FixedSankeyGeometry;
  transitionKey?: string;
}) {
  const [motion, setMotion] = useState<GeometryMotionState>(() => ({ key: transitionKey, geometry }));

  if (transitionKey !== motion.key) {
    setMotion({
      key: transitionKey,
      geometry,
      transition:
        geometry && motion.geometry && !prefersReducedMotion()
          ? { from: motion.geometry, to: geometry, progress: 0 }
          : undefined,
    });
  } else if (geometry !== motion.geometry && !motion.transition) {
    setMotion({ ...motion, geometry });
  }

  useEffect(() => {
    const from = motion.transition?.from;
    const to = motion.transition?.to;
    if (!from || !to) return;

    const startedAt = performance.now();
    let animationFrame = 0;
    const animate = (now: number) => {
      const elapsed = Math.min((now - startedAt) / TRANSITION_DURATION_MS, 1);
      const progress = 1 - (1 - elapsed) ** 3;
      setMotion(current => {
        if (current.transition?.from !== from || current.transition.to !== to) return current;
        if (elapsed === 1) return { key: current.key, geometry: to };
        return { ...current, transition: { from, to, progress } };
      });
      if (elapsed < 1) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [motion.transition?.from, motion.transition?.to]);

  const transition = motion.transition;
  return transition
    ? interpolateSankeyGeometry(transition.from, transition.to, transition.progress)
    : (geometry ?? motion.geometry);
}
