import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, CirclePause, X } from 'lucide-react';
import { useContext, useEffect, useRef } from 'react';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { useWorkflowStepDetail } from '../../context/workflow-step-detail-context';
import type { WorkflowDataSelection } from '../../context/workflow-step-detail-context';
import { useWorkflowData, workflowDataKey } from './use-workflow-data';

export function WorkflowDataInspector({ selection }: { selection: WorkflowDataSelection }) {
  const { closeStepDetail } = useWorkflowStepDetail();
  const { result } = useContext(WorkflowRunContext);
  const { name, direction, value } = useWorkflowData(selection);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      aria-label="Data inspector"
      className="workflow-data-inspector rounded-studio-panel border-border1/50 bg-surface3 shadow-panel flex min-h-0 flex-col overflow-hidden border"
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          closeStepDetail();
        }
      }}
    >
      <header className="border-border1/50 bg-surface2 flex shrink-0 items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Badge variant="neutral" emphasis="muted">
            {direction === 'input' ? <ArrowDownToLine /> : <ArrowUpFromLine />}
            {direction === 'input' ? 'Input' : 'Output'}
          </Badge>
          <Txt as="h2" variant="ui-sm" className="break-words text-neutral6 font-medium">
            {name}
          </Txt>
        </div>
        <Button ref={closeRef} variant="ghost" size="icon-sm" tooltip="Close data inspector" onClick={closeStepDetail}>
          <X />
        </Button>
      </header>
      <div className="min-h-0 overflow-auto overscroll-contain p-3">
        {value === undefined ? (
          <Txt as="p" variant="ui-sm" className="p-2 text-neutral3">
            No {direction} recorded for this selection.
          </Txt>
        ) : (
          <CodeEditor
            key={workflowDataKey(selection)}
            value={safeStringify(value, 2)}
            editable={false}
            lineNumbers={false}
            className="min-w-0 rounded-lg bg-surface2 p-3"
          />
        )}
      </div>
      {result?.status === 'suspended' && (
        <div className="shrink-0 border-t border-border1/50 p-2">
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
