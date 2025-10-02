import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useContext } from 'react';

import { Button } from '@/ds/components/Button';

import { TraceContext } from './context/trace-context';
import SpanView from './trace-span-view';
import { Txt } from '@/ds/components/Txt';

import { Icon } from '@/ds/icons';
import { Header } from '@/ds/components/Header';
import { Badge } from '@/ds/components/Badge';

export function TraceDetails() {
  const { trace, currentTraceIndex, prevTrace, nextTrace, traces } = useContext(TraceContext);

  const actualTrace = traces[currentTraceIndex];

  if (!actualTrace || !trace) return null;

  // 2 = error
  const hasFailure = trace.some(span => span.status.code === 2);

  return (
    <aside>
      <Header>
        <div className="flex items-center gap-1">
          <Button className="bg-transparent border-none" onClick={prevTrace} disabled={currentTraceIndex === 0}>
            <Icon>
              <ChevronUp />
            </Icon>
          </Button>
          <Button
            className="bg-transparent border-none"
            onClick={nextTrace}
            disabled={currentTraceIndex === traces.length - 1}
          >
            <Icon>
              <ChevronDown />
            </Icon>
          </Button>
        </div>
        <div className="flex items-center gap-1 justify-between w-full">
          <Txt variant="ui-lg" className="font-medium text-icon5 shrink-0">
            Trace <span className="ml-2 text-icon3">{actualTrace.traceId.substring(0, 7)}</span>
          </Txt>

          {hasFailure && (
            <Badge variant="error" icon={<X />}>
              Failed
            </Badge>
          )}
        </div>
      </Header>

      <div className="p-5">
        <SpanView trace={trace} />
      </div>
    </aside>
  );
}
