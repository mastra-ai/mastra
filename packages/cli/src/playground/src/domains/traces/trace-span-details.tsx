import { useContext } from 'react';

import { SyntaxHighlighter } from '@/components/syntax-highlighter';

import { cn } from '@/lib/utils';

import { TraceContext } from './context/trace-context';
import type { Span } from './types';
import { cleanString, formatDuration, formatOtelTimestamp, formatOtelTimestamp2, transformKey } from './utils';

export function SpanDetail() {
  const { span } = useContext(TraceContext);

  const duration = span?.endTime ? Number(span?.endTime) - Number(span?.startTime) : 0;

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center gap-2 px-6 pt-[1.56rem]">
        <span className="rounded bg-[#314431] p-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="21" height="20" viewBox="0 0 21 20" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9.3726 2.10787C9.99493 1.48554 11.0066 1.48705 11.6274 2.10787L13.1306 3.61106C13.7529 4.23339 13.7514 5.24504 13.1306 5.86586L11.6274 7.36906C11.0051 7.99138 9.99342 7.98988 9.3726 7.36906L7.86941 5.86586C7.24708 5.24354 7.24858 4.23188 7.86941 3.61106L9.3726 2.10787ZM4.11141 7.36906C4.73374 6.74673 5.74539 6.74824 6.36621 7.36906L7.86941 8.87225C8.49173 9.49458 8.49023 10.5062 7.8694 11.127L6.36621 12.6302C5.74388 13.2526 4.73223 13.2511 4.11141 12.6302L2.60822 11.127C1.98589 10.5047 1.9874 9.49307 2.60822 8.87225L4.11141 7.36906ZM14.6338 7.36906C15.2561 6.74673 16.2678 6.74824 16.8886 7.36906L18.3918 8.87225C19.0141 9.49458 19.0126 10.5062 18.3918 11.127L16.8886 12.6302C16.2663 13.2526 15.2546 13.2511 14.6338 12.6302L13.1306 11.127C12.5083 10.5047 12.5098 9.49307 13.1306 8.87225L14.6338 7.36906ZM9.3726 12.6302C9.99493 12.0079 11.0066 12.0094 11.6274 12.6302L13.1306 14.1334C13.7529 14.7558 13.7514 15.7674 13.1306 16.3882L11.6274 17.8914C11.0051 18.5138 9.99342 18.5123 9.3726 17.8914L7.86941 16.3882C7.24708 15.7659 7.24859 14.7543 7.86941 14.1334L9.3726 12.6302Z"
              fill="white"
            />
          </svg>
        </span>
        <h3 className="text-[0.9rem] font-medium">{span?.name}</h3>
      </div>
      <div className="grid grid-cols-3 px-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-mastra-el-3">Duration</span>
          <span className="font-mono text-xs"> {duration ? formatDuration(duration) : ''}ms</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-mastra-el-3">Time</span>
          <span className="font-mono text-xs">{span?.startTime ? formatOtelTimestamp(span?.startTime) : ''}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-mastra-el-3">Status</span>
          <span className={cn('font-mono text-xs', span?.status?.code == 0 ? 'text-[#6CD063]' : 'text-[#FF4500]')}>
            {span?.status?.code == 0 ? 'OK' : 'ERROR'}
          </span>
        </div>
      </div>
      <div className="border-t-[0.5px] px-6 pt-4">{span && <Attributes span={span} />}</div>
      <div className="border-t-[0.5px] px-6 pt-4">{span && span?.events?.length > 0 && <Events span={span} />}</div>
    </div>
  );
}

function Events({ span }: { span: Span }) {
  if (!span.events) return null;

  return (
    <div className="flex flex-col px-2">
      <p className="text-lg">Events</p>
      {span.events.map(event => (
        <div
          key={event.name}
          className={cn('flex flex-col gap-2 border-b-[0.5px] pt-4 pb-2', event.attributes?.length === 0 && 'pb-4')}
        >
          <p className="text-xs text-mastra-el-3">Name</p>
          <p className="font-mono text-xs">{event.name}</p>
          <p className="text-xs text-mastra-el-3">Time</p>
          <p className="font-mono text-xs">
            {event.timeUnixNano ? formatOtelTimestamp2(Number(event.timeUnixNano)) : ''}
          </p>
          {event.attributes?.length > 0 ? <AttributesValues attributes={JSON.stringify(event.attributes)} /> : null}
        </div>
      ))}
    </div>
  );
}
function Attributes({ span }: { span: Span }) {
  if (!span.attributes) return null;

  return <AttributesValues attributes={span.attributes} />;
}

function AttributesValues({ attributes, depth = 0 }: { attributes: unknown; depth?: number }) {
  if (attributes === null) return null;
  if (attributes === undefined) return null;

  if (typeof attributes === 'string') {
    try {
      const attr = JSON.parse(attributes);

      if (typeof attr === 'object' || Array.isArray(attr)) {
        return <SyntaxHighlighter data={attr} />;
      }
    } catch {
      return <span className="text-sm">{attributes ? cleanString(attributes.toString()) : 'N/A'}</span>;
    }
  }

  const processedValue = attributes;

  if (Array.isArray(processedValue)) {
    if (processedValue.length === 0) return null;
    return (
      <div className="relative">
        <div className="mt-1 gap-3">
          {processedValue.map((item, index) => (
            <div key={index} className="flex flex-col gap-1">
              <AttributesValues key={index} attributes={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (typeof processedValue === 'object') {
    const entries = Object.entries(processedValue);
    if (entries.length === 0) return null;

    return (
      <div className="relative">
        <div className="mt-1">
          {entries.map(([key, val]) => (
            <div key={key} className="flex flex-col gap-2 p-2 pl-0">
              <span className="text-sm capitalize text-mastra-el-3">{transformKey(key)}</span>
              <AttributesValues attributes={val} depth={depth + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (typeof processedValue === 'boolean')
    return <span className="font-mono text-sm">{processedValue.toString() || 'N/A'}</span>;
  if (typeof processedValue === 'number') return <span className="font-mono text-sm">{processedValue.toString()}</span>;
  if (typeof processedValue === 'string')
    return <span className="font-mono text-sm">{processedValue ? cleanString(processedValue.toString()) : 'N/A'}</span>;

  return <span className="text-gray-400">{String(processedValue)}</span>;
}
