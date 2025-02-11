import { ChevronDown, XIcon } from 'lucide-react';
import { useContext } from 'react';

import { Button } from '@/components/ui/button';

import { TraceContext } from './context/trace-context';
import SpanView from './trace-span-view';

export function TraceDetails() {
  const { trace, currentTraceIndex, prevTrace, nextTrace, traces, clearData } = useContext(TraceContext);

  return (
    <div>
      <div className="flex items-center justify-between px-6 pt-[1.56rem]">
        <div className="flex items-center gap-2">
          <h3 className="text-[1.125rem]">Trace Span{trace?.length && trace.length > 1 ? 's' : ''}</h3>
          <span className="text-xs text-[#939393]">
            {trace?.length ? trace.length : 0} span{trace?.length && trace.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                prevTrace();
              }}
              disabled={currentTraceIndex === 0}
              variant={'secondary'}
              size={'icon'}
              className="!h-3 !w-3 rotate-180 !px-3 py-3 text-[#939393] transition-colors hover:text-white"
            >
              <ChevronDown />
            </Button>{' '}
            <Button
              onClick={() => {
                nextTrace();
              }}
              disabled={currentTraceIndex === traces.length - 1}
              variant={'secondary'}
              size={'icon'}
              className="!h-3 !w-3 !px-3 py-3 text-[#939393] transition-colors hover:text-white"
            >
              <ChevronDown />
            </Button>
          </div>
          <span className="bg-secondary inline-block h-5 w-px"></span>
          <Button
            onClick={() => {
              clearData();
            }}
            variant={'secondary'}
            size={'icon'}
            className="!h-3 !w-3 !px-3 py-3 text-[#939393] transition-colors hover:text-white"
          >
            <XIcon />
          </Button>
        </div>
      </div>
      <div className="p-6 px-0"> {trace && <SpanView trace={trace} />}</div>
    </div>
  );
}
