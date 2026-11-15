import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

/** How long a view change takes: nodes glide, resize and fade over this. */
export const KNOWLEDGE_GRAPH_TRANSITION_MS = 700;

/** Whether the person has not asked the system to cut motion. Without `matchMedia` (a test DOM) nothing animates. */
export function prefersMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
}

interface Ghost<N> {
  node: N;
  fading: boolean;
}

/**
 * The nodes plus, for one transition after a view change, the nodes that just left: drawn where they were,
 * then faded out, so a page that is not in the next view fades instead of vanishing. With `enabled` false
 * (reduced motion) it returns the nodes untouched.
 */
export function useLeavingNodes<N extends { id: string; style?: CSSProperties }>(nodes: N[], enabled: boolean): N[] {
  // The nodes are rebuilt on many renders, so a change of view is a change in which pages are drawn.
  const key = nodes.map(node => node.id).join('\u0000');
  const [previousKey, setPreviousKey] = useState(key);
  const [ghosts, setGhosts] = useState<Ghost<N>[]>([]);
  const lastNodes = useRef(nodes);
  useEffect(() => {
    lastNodes.current = nodes;
  });
  // Adjusting state while rendering (not in an effect) keeps the leaving node from unmounting for a frame.
  if (previousKey !== key) {
    setPreviousKey(key);
    if (enabled) {
      const present = new Set(nodes.map(node => node.id));
      const gone = lastNodes.current.filter(node => !present.has(node.id));
      setGhosts(current => [
        ...current.filter(ghost => !present.has(ghost.node.id)),
        ...gone
          .filter(node => !current.some(ghost => ghost.node.id === node.id))
          .map(node => ({ node, fading: false })),
      ]);
    }
  }

  const waiting = ghosts.some(ghost => !ghost.fading);
  const removal = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!waiting) return;
    // One frame at full opacity, then the fade; the ghosts go once it has run.
    const frame = requestAnimationFrame(() => {
      setGhosts(current => current.map(ghost => ({ ...ghost, fading: true })));
      clearTimeout(removal.current);
      removal.current = setTimeout(
        () => setGhosts(current => current.filter(ghost => !ghost.fading)),
        KNOWLEDGE_GRAPH_TRANSITION_MS + 50,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [waiting, ghosts.length]);
  useEffect(() => () => clearTimeout(removal.current), []);

  if (!enabled || ghosts.length === 0) return nodes;
  return [
    ...nodes,
    ...ghosts.map(({ node, fading }) => ({
      ...node,
      selectable: false,
      focusable: false,
      style: { ...node.style, opacity: fading ? 0 : 1, pointerEvents: 'none' as const },
    })),
  ];
}
