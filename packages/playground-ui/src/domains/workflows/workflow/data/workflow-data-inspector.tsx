import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, CirclePause, X } from 'lucide-react';
import { useContext, useEffect, useRef } from 'react';
import { panelSurfaceStyle } from '../../components/workflow-layout';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { useWorkflowStepDetail } from '../../context/workflow-step-detail-context';
import type { WorkflowDataSelection } from '../../context/workflow-step-detail-context';
import { useWorkflowData, workflowDataKey } from './use-workflow-data';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';

const DIRECTION_ICONS = { input: ArrowDownToLine, output: ArrowUpFromLine };
const DIRECTION_LABELS = { input: 'Input', output: 'Output' };

export function WorkflowDataInspector({ selection }: { selection: WorkflowDataSelection }) {
  const { closeStepDetail } = useWorkflowStepDetail();
  const { result } = useContext(WorkflowRunContext);
  const { name, direction, value } = useWorkflowData(selection);
  const DirectionIcon = DIRECTION_ICONS[direction];
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectionKey = workflowDataKey(selection);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [selectionKey]);

  return (
    <section
      aria-label="Data inspector"
      className={`workflow-data-inspector ${panelSurfaceStyle} flex min-h-0 flex-col overflow-hidden`}
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          closeStepDetail();
        }
      }}
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-border/50 bg-background px-5 py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Badge variant="neutral" emphasis="muted" icon={<DirectionIcon />}>
            {DIRECTION_LABELS[direction]}
          </Badge>
          <Txt as="h2" variant="column" tone="ink" className="break-words">
            {name}
          </Txt>
        </div>
        <Button ref={closeRef} variant="ghost" size="icon-sm" tooltip="Close data inspector" onClick={closeStepDetail}>
          <X />
        </Button>
      </header>
      <div className="min-h-0 overflow-auto overscroll-contain p-3">
        {value === undefined ? (
          <Txt as="p" variant="caption" tone="muted" className="p-2">
            No {direction} recorded for this selection.
          </Txt>
        ) : (
          <CodeEditor
            key={selectionKey}
            value={safeStringify(value, 2)}
            editable={false}
            lineNumbers={false}
            className="min-w-0 rounded-lg bg-background p-3"
          />
        )}
      </div>
      {result?.status === 'suspended' && (
        <div className="shrink-0 border-t border-border/50 p-2">
          <Button variant="ghost" className="w-full justify-start text-warning1" onClick={closeStepDetail}>
            <CirclePause />
            Return to suspended step
            <ChevronRight className="ml-auto" />
          </Button>
        </div>
      )}
    </section>
  );
}
