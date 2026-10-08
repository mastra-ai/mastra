import { cn } from '@mastra/playground-ui/utils/cn';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { KnowledgeHoverContent } from './KnowledgeHoverContent';
import { createKnowledgeHoverFollower } from './knowledgeHoverMotion';
import type { KnowledgeFlowEdge, NodeFlowNode, RecordFlowNode } from './graphModel';
import type { KnowledgeGraphNode } from '../../services/knowledge';

export type KnowledgeHoverTarget =
  | { kind: 'node'; node: NodeFlowNode }
  | { kind: 'edge'; edge: KnowledgeFlowEdge }
  | { kind: 'record'; record: RecordFlowNode };

type Point = { x: number; y: number };
type HoverSnapshot = {
  current: KnowledgeHoverTarget;
  sequence: number;
  outgoing?: { target: KnowledgeHoverTarget; width: number };
};

function targetId(target: KnowledgeHoverTarget) {
  if (target.kind === 'node') return `node:${target.node.id}`;
  if (target.kind === 'record') return `record:${target.record.id}`;
  return `edge:${target.edge.id}`;
}

export interface KnowledgeHoverHandle {
  show: (hover: KnowledgeHoverTarget & Point) => void;
  move: (point: Point) => void;
  hide: (immediate?: boolean) => void;
}

/** The surface persists across targets. Only content changes render this overlay. */
export function KnowledgeGraphHover({
  ref,
  nodesById,
}: {
  ref: Ref<KnowledgeHoverHandle>;
  nodesById: Map<string, KnowledgeGraphNode>;
}) {
  const [snapshot, setSnapshot] = useState<HoverSnapshot>();
  const positionRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const follower = useRef<ReturnType<typeof createKnowledgeHoverFollower>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentId = useRef<string>(undefined);
  const sequence = useRef(0);

  useLayoutEffect(() => {
    if (!positionRef.current) return;
    const motion = createKnowledgeHoverFollower(positionRef.current);
    follower.current = motion;
    return () => {
      motion.stop();
      follower.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const surface = surfaceRef.current;
    if (!content || !surface) return;
    function measure() {
      if (!content || !surface) return;
      const padding = getComputedStyle(surface);
      const width = content.offsetWidth + parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight);
      const height = content.offsetHeight + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom);
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      follower.current?.resize(width, height);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [snapshot?.sequence]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useImperativeHandle(ref, () => ({
    show(hover) {
      clearTimeout(hideTimer.current);
      const position = positionRef.current;
      if (!position) return;
      const wasHidden = position.dataset.state !== 'open';
      position.dataset.state = 'open';
      position.setAttribute('aria-hidden', 'false');
      follower.current?.move(hover, wasHidden);
      const id = targetId(hover);
      if (currentId.current === id) return;
      currentId.current = id;
      const nextSequence = ++sequence.current;
      const width = contentRef.current?.offsetWidth ?? 0;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setSnapshot(previous => ({
        current: hover,
        sequence: nextSequence,
        outgoing: previous && !wasHidden && !reducedMotion ? { target: previous.current, width } : undefined,
      }));
    },
    move(point) {
      if (positionRef.current?.dataset.state === 'open') follower.current?.move(point);
    },
    hide(immediate = false) {
      clearTimeout(hideTimer.current);
      function close() {
        positionRef.current?.setAttribute('data-state', 'closed');
        positionRef.current?.setAttribute('aria-hidden', 'true');
        follower.current?.stop();
      }
      if (immediate) {
        close();
        return;
      }
      // Adjacent targets share the surface instead of flashing closed between them.
      hideTimer.current = setTimeout(close, 100);
    },
  }));

  return (
    <div
      ref={positionRef}
      role="tooltip"
      aria-hidden="true"
      data-testid="knowledge-hover-card"
      className="knowledge-hover pointer-events-none fixed top-0 left-0 z-50"
    >
      <div
        ref={surfaceRef}
        className={cn(overlaySurfaceStyle, 'knowledge-hover-surface relative overflow-hidden rounded-lg p-3')}
      >
        {snapshot?.outgoing ? (
          <div
            key={`out-${snapshot.sequence}`}
            className="knowledge-hover-outgoing absolute top-3 left-3"
            aria-hidden="true"
            style={{ width: snapshot.outgoing.width }}
            onAnimationEnd={() => {
              const completedSequence = snapshot.sequence;
              setSnapshot(current =>
                current?.sequence === completedSequence ? { ...current, outgoing: undefined } : current,
              );
            }}
          >
            <KnowledgeHoverContent hover={snapshot.outgoing.target} nodesById={nodesById} />
          </div>
        ) : null}
        {snapshot ? (
          <div key={snapshot.sequence} ref={contentRef} className="knowledge-hover-content">
            <KnowledgeHoverContent hover={snapshot.current} nodesById={nodesById} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
