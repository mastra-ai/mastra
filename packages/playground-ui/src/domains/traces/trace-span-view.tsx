import { TraceTree } from '@/ds/components/TraceTree';

import type { Span, SpanNode } from './types';
import { Trace } from '@/ds/components/TraceTree/Trace';
import { Spans } from '@/ds/components/TraceTree/Spans';
import { Span as SpanComponent } from '@/ds/components/TraceTree/Span';
import { TraceContext } from './context/trace-context';
import { useContext } from 'react';
import { getSpanVariant } from './utils/getSpanVariant';

function buildTree(items: Span[], parentSpanId: string | null = null): SpanNode[] {
  return items
    .filter(item => item.parentSpanId === parentSpanId)
    .map(item => ({
      ...item,
      children: buildTree(items, item.id),
    }));
}

export interface SpanViewProps {
  trace: Span[];
}

const NestedSpans = ({ spans }: { spans: SpanNode[] }) => {
  const { span: activeSpan, setSpan } = useContext(TraceContext);

  return (
    <Spans>
      {spans.map(span => {
        const isActive = span.id === activeSpan?.id;

        return (
          <SpanComponent
            key={span.id}
            spans={span.children.length > 0 && <NestedSpans spans={span.children} />}
            durationMs={span.duration / 1000}
            variant={getSpanVariant(span)}
            isActive={isActive}
            onClick={() => setSpan(span)}
          >
            {span.name}
          </SpanComponent>
        );
      })}
    </Spans>
  );
};

export default function SpanView({ trace }: SpanViewProps) {
  // SQL query sorts by startTime in descending order, so we need to reverse and copy the array for spans to show in correct order
  const shallowCopy = [...trace];
  const tree = buildTree(shallowCopy.reverse());
  const { span: activeSpan, setSpan } = useContext(TraceContext);
  return (
    <TraceTree>
      {tree.map(node => (
        <Trace
          name={node.name}
          durationMs={node.duration / 1000}
          spans={<NestedSpans spans={node.children} />}
          variant={getSpanVariant(node)}
          isActive={node.id === activeSpan?.id}
          onClick={() => setSpan(node)}
        />
      ))}
    </TraceTree>
  );
}
