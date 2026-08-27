import type { SpanNode } from '@mastra/playground-ui/domains/traces/components';

import type { TimelineSpan } from '../lib/build-thread-timeline';
import { TimelineEntry } from './timeline-entry';

export type SpanRowsContext = {
  /** Epoch ms the turn started, so every row shares one origin on the gutter. */
  turnStart?: number;
  /** Enables the span comment bubbles. Omit it to render rows without any feedback affordance. */
  traceId?: string;
  /** Comments per span id, so a row can advertise an existing thread. */
  feedbackCounts?: Record<string, number>;
};

export type SpanRowsProps = SpanRowsContext & {
  node: SpanNode<TimelineSpan>;
};

/**
 * Turns one span of the tree into the `<li>` rows it deserves.
 *
 * Owning the `<li>` here rather than in the list is what lets a span type depart from one-row-per-
 * span: a renderer can return a fragment of several rows, absorb its children into its own row, or
 * drop itself and promote its subtree. The default, below, is a row for the span followed by its
 * children — which is what every type does until one has a reason not to.
 *
 * Whatever the shape, each row keeps the `spanId` of the span it came from, so a comment left on it
 * stays scoped to exactly that part of the interaction.
 */
export function SpanRows({ node, turnStart, traceId, feedbackCounts }: SpanRowsProps) {
  const { span, children } = node;

  return (
    <>
      <TimelineEntry
        span={span}
        turnStart={turnStart}
        traceId={traceId}
        feedbackCount={span.spanId ? feedbackCounts?.[span.spanId] : undefined}
      />
      <SpanRowList nodes={children} turnStart={turnStart} traceId={traceId} feedbackCounts={feedbackCounts} />
    </>
  );
}

export type SpanRowListProps = SpanRowsContext & {
  nodes: SpanNode<TimelineSpan>[];
};

/** Renders a level of the tree, in chronological order. */
export function SpanRowList({ nodes, ...context }: SpanRowListProps) {
  return nodes.map(node => <SpanRows key={node.span.spanId} node={node} {...context} />);
}
