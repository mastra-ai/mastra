import { cn } from '@mastra/playground-ui/utils/cn';
import type { ExperimentUISpan, ExperimentUISpanStyle } from '../types';
import { ExperimentTraceTimelineStructureSign } from './experiment-trace-timeline-structure-sign';

type ExperimentTraceTimelineNameColProps = {
  span: ExperimentUISpan;
  spanUI?: ExperimentUISpanStyle | null;
  isFaded?: boolean;
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  isLastChild?: boolean;
  hasChildren?: boolean;
  isRootSpan?: boolean;
  isExpanded?: boolean;
  toggleChildren?: () => void;
};

export function ExperimentTraceTimelineNameCol({
  span,
  spanUI: _spanUI,
  isFaded: _isFaded,
  depth = 0,
  onSpanClick,
  selectedSpanId: _selectedSpanId,
  isLastChild,
  hasChildren,
  isRootSpan,
  isExpanded,
  toggleChildren,
}: ExperimentTraceTimelineNameColProps) {
  return (
    <div
      className="flex overflow-x-auto"
      style={{
        paddingLeft: `${depth * 1.5}rem`,
        //border: '2px dashed cyan'
      }}
    >
      {!isRootSpan && (
        <button
          onClick={() => toggleChildren?.()}
          disabled={!hasChildren}
          className={cn({
            'cursor-default': !hasChildren,
            'cursor-pointer': hasChildren,
          })}
        >
          <ExperimentTraceTimelineStructureSign
            isLastChild={isLastChild}
            hasChildren={Boolean(hasChildren)}
            expanded={isExpanded}
          />
        </button>
      )}

      <button className="truncate" onClick={() => onSpanClick?.(span.id)}>
        {span.name}
      </button>
    </div>
  );
}
