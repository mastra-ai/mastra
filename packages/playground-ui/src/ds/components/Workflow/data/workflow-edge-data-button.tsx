import { Database } from 'lucide-react';
import { useState } from 'react';
import type { MouseEventHandler } from 'react';
import { cn } from '../../../../lib/utils';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '../../../primitives/raised-surface';
import { Button } from '../../Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../../Dialog';
import { Txt } from '../../Txt';
import { WorkflowCodeContent } from './workflow-code-dialog-content';

export interface WorkflowEdgeDataButtonProps {
  previousStepId?: string;
  output?: unknown;
  label?: string;
  selected?: boolean;
  onInspect?: MouseEventHandler<HTMLButtonElement>;
}

export const WorkflowEdgeDataButton = ({
  previousStepId,
  output,
  label,
  selected,
  onInspect,
}: WorkflowEdgeDataButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dataLabel = label ?? (previousStepId ? `${previousStepId} output` : 'Previous output');

  if (output === undefined) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={onInspect ?? (() => setIsOpen(true))}
        aria-label={`View ${dataLabel}`}
        aria-pressed={selected}
        className={cn(
          raisedSurfaceStyle,
          surfaceStateLayerStyle,
          'h-7 rounded-lg px-2 text-foreground aria-pressed:before:bg-fill',
        )}
        icon={<Database className="text-muted-foreground" />}
      >
        Data
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Step output</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="min-w-0 rounded-lg border border-border bg-background p-3">
              <Txt variant="caption" tone="ink" className="mb-2 block">
                {dataLabel}
              </Txt>
              <WorkflowCodeContent data={output} />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
