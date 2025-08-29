import { DialogTitle } from '@/components/ui/dialog';
import { DialogContent } from '@/components/ui/dialog';
import { Button } from '@/ds/components/Button';
import { Dialog } from '@/components/ui/dialog';
import { CodeDialogContent } from './workflow-code-dialog-content';
import { useState } from 'react';
import { WorkflowRunEventForm, WorkflowSendEventFormProps } from './workflow-run-event-form';
import { cn } from '@/lib/utils';

export interface WorkflowStepActionBarProps {
  input?: any;
  output?: any;
  resumeData?: any;
  error?: any;
  stepName: string;
  mapConfig?: string;
  event?: string;
  onShowTrace?: () => void;
  onShowNestedGraph?: () => void;
  onSendEvent?: WorkflowSendEventFormProps['onSendEvent'];
  runId?: string;
  status?: 'running' | 'success' | 'failed' | 'suspended' | 'waiting';
}

export const WorkflowStepActionBar = ({
  input,
  output,
  resumeData,
  error,
  mapConfig,
  stepName,
  event,
  onShowTrace,
  onShowNestedGraph,
  onSendEvent,
  runId,
  status,
}: WorkflowStepActionBarProps) => {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isResumeDataOpen, setIsResumeDataOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isMapConfigOpen, setIsMapConfigOpen] = useState(false);
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);

  const dialogContentClass = 'bg-surface2 rounded-lg border-sm border-border1 max-w-4xl w-full px-0';
  const dialogTitleClass = 'border-b-sm border-border1 pb-4 px-6';

  const showEventForm = event && onSendEvent && runId;

  return (
    <>
      {(input || output || error || mapConfig || resumeData || onShowNestedGraph || showEventForm) && (
        <div
          className={cn(
            'flex flex-wrap items-center bg-surface4 border-t-sm border-border1 px-2 py-1 gap-2 rounded-b-lg',
            status === 'success' && 'bg-accent1Dark',
            status === 'failed' && 'bg-accent2Dark',
            status === 'suspended' && 'bg-accent3Dark',
            status === 'waiting' && 'bg-accent5Dark',
            status === 'running' && 'bg-accent6Dark',
          )}
        >
          {onShowNestedGraph && <Button onClick={onShowNestedGraph}>View nested graph</Button>}
          {mapConfig && (
            <>
              <Button onClick={() => setIsMapConfigOpen(true)}>Map config</Button>

              <Dialog open={isMapConfigOpen} onOpenChange={setIsMapConfigOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} map config</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={mapConfig} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {input && (
            <>
              <Button onClick={() => setIsInputOpen(true)}>Input</Button>

              <Dialog open={isInputOpen} onOpenChange={setIsInputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} input</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={input} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {resumeData && (
            <>
              <Button onClick={() => setIsResumeDataOpen(true)}>Resume data</Button>

              <Dialog open={isResumeDataOpen} onOpenChange={setIsResumeDataOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} resume data</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={resumeData} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {output && (
            <>
              <Button onClick={() => setIsOutputOpen(true)}>Output</Button>

              <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} output</DialogTitle>
                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={output} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {error && (
            <>
              <Button onClick={() => setIsErrorOpen(true)}>Error</Button>

              <Dialog open={isErrorOpen} onOpenChange={setIsErrorOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} error</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={error} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {onShowTrace && <Button onClick={onShowTrace}>Show trace</Button>}

          {showEventForm && (
            <>
              <Button className="!text-accent5" onClick={() => setIsEventFormOpen(true)}>
                Send event
              </Button>

              <Dialog open={isEventFormOpen} onOpenChange={setIsEventFormOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>Send {event} event</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <WorkflowRunEventForm event={event} runId={runId} onSendEvent={onSendEvent} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}
    </>
  );
};
