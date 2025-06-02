import { TraceTree } from '@/ds/components/TraceTree';

import type { Span, SpanNode } from './types';
import { Trace } from '@/ds/components/TraceTree/Trace';
import { Spans } from '@/ds/components/TraceTree/Spans';
import { Span as SpanComponent } from '@/ds/components/TraceTree/Span';
import { TraceContext } from './context/trace-context';
import { useContext } from 'react';
import { getSpanVariant } from './utils/getSpanVariant';
import { createSpanTree } from './utils/createSpanTree';

interface NestedSpansProps {
  spanNodes: SpanNode[];
}

const NestedSpans = ({ spanNodes }: NestedSpansProps) => {
  const { span: activeSpan, setSpan } = useContext(TraceContext);

  return (
    <Spans>
      {spanNodes.map(spanNode => {
        const isActive = spanNode.id === activeSpan?.id;

        return (
          <SpanComponent
            key={spanNode.id}
            spans={spanNode.children.length > 0 && <NestedSpans spanNodes={spanNode.children} />}
            durationMs={spanNode.duration}
            offsetMs={spanNode.offset}
            variant={getSpanVariant(spanNode)}
            isActive={isActive}
            onClick={() => setSpan(spanNode)}
            totalDurationMs={spanNode.totalDurationMs}
          >
            {spanNode.name}
          </SpanComponent>
        );
      })}
    </Spans>
  );
};

export interface SpanViewProps {
  trace: Span[];
}

export default function SpanView({ trace }: SpanViewProps) {
  // SQL query sorts by startTime in descending order, so we need to reverse and copy the array for spans to show in correct order
  const { span: activeSpan, setSpan } = useContext(TraceContext);

  const tree = createSpanTree(trace);

  return (
    <TraceTree>
      {tree.map(node => (
        <Trace
          name={node.name}
          durationMs={node.duration}
          totalDurationMs={node.totalDurationMs}
          spans={<NestedSpans spanNodes={node.children} />}
          variant={getSpanVariant(node)}
          isActive={node.id === activeSpan?.id}
          onClick={() => setSpan(node)}
        />
      ))}
    </TraceTree>
  );
}
