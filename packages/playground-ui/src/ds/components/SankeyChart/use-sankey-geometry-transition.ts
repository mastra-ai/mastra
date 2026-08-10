import { useEffect, useState, useSyncExternalStore } from 'react';

import type { FixedSankeyGeometry, FixedSankeyLinkGeometry, FixedSankeyNodeGeometry } from './sankey-chart-utils';

const TRANSITION_DURATION_MS = 850;

type GeometryTransition = {
  from: FixedSankeyGeometry;
  to: FixedSankeyGeometry;
  startedAt: number;
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

class SankeyGeometryMotionStore {
  private animationFrame = 0;
  private key?: string;
  private listeners = new Set<() => void>();
  private snapshot?: FixedSankeyGeometry;
  private target?: FixedSankeyGeometry;
  private transition?: GeometryTransition;

  constructor(key?: string, geometry?: FixedSankeyGeometry) {
    this.key = key;
    this.snapshot = geometry;
    this.target = geometry;
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  transitionTo(key: string | undefined, geometry: FixedSankeyGeometry | undefined) {
    if (key === this.key && geometry === this.target) return;

    const keyChanged = key !== this.key;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.key = key;
    this.target = geometry;

    if (!keyChanged || !geometry || !this.snapshot || prefersReducedMotion()) {
      this.transition = undefined;
      this.publish(geometry);
      return;
    }

    this.transition = { from: this.snapshot, to: geometry, startedAt: performance.now() };
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.listeners.clear();
  }

  private animate = (now: number) => {
    const transition = this.transition;
    if (!transition) return;

    const elapsed = Math.min((now - transition.startedAt) / TRANSITION_DURATION_MS, 1);
    const progress = 1 - (1 - elapsed) ** 3;
    this.publish(interpolateSankeyGeometry(transition.from, transition.to, progress));

    if (elapsed < 1) {
      this.animationFrame = requestAnimationFrame(this.animate);
      return;
    }

    this.transition = undefined;
    this.animationFrame = 0;
  };

  private publish(geometry: FixedSankeyGeometry | undefined) {
    this.snapshot = geometry;
    for (const listener of this.listeners) listener();
  }
}

export function useSankeyGeometryTransition({
  geometry,
  transitionKey,
}: {
  geometry?: FixedSankeyGeometry;
  transitionKey?: string;
}) {
  const [store] = useState(() => new SankeyGeometryMotionStore(transitionKey, geometry));
  const animatedGeometry = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    store.transitionTo(transitionKey, geometry);
  }, [geometry, store, transitionKey]);

  useEffect(() => () => store.dispose(), [store]);

  return animatedGeometry;
}
