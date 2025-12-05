import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CodeDialogContent } from './workflow-code-dialog-content';
import { useContext, useState } from 'react';
import { cn } from '@/lib/utils';
import { WorkflowTimeTravelForm } from './workflow-time-travel-form';
import { WorkflowRunContext } from '../context/workflow-run-context';
import type { TripwireData } from '../context/use-current-run';

export interface WorkflowStepActionBarProps {
  input?: any;
  output?: any;
  suspendOutput?: any;
  resumeData?: any;
  error?: any;
  tripwire?: TripwireData;
  stepName: string;
  stepId?: string;
  mapConfig?: string;
  onShowNestedGraph?: () => void;
  status?: 'running' | 'success' | 'failed' | 'suspended' | 'waiting' | 'tripwire';
  stepKey?: string;
}

export const WorkflowStepActionBar = ({
  input,
  output,
  resumeData,
  suspendOutput,
  error,
  tripwire,
  mapConfig,
  stepName,
  stepId,
  onShowNestedGraph,
  status,
  stepKey,
}: WorkflowStepActionBarProps) => {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isResumeDataOpen, setIsResumeDataOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isTripwireOpen, setIsTripwireOpen] = useState(false);
  const [isMapConfigOpen, setIsMapConfigOpen] = useState(false);
  const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);

  const { withoutTimeTravel } = useContext(WorkflowRunContext);

  const dialogContentClass = 'bg-surface2 rounded-lg border-sm border-border1 max-w-4xl w-full px-0';
  const dialogTitleClass = 'border-b-sm border-border1 pb-4 px-6';

  const showTimeTravel = !withoutTimeTravel && stepKey && !mapConfig;

  return (
    <>
      {(input || output || error || tripwire || mapConfig || resumeData || onShowNestedGraph || showTimeTravel) && (
        <div
          className={cn(
            'flex flex-wrap items-center bg-surface4 border-t-sm border-border1 px-2 py-1 gap-2 rounded-b-lg',
            status === 'success' && 'bg-accent1Dark',
            status === 'failed' && 'bg-accent2Dark',
            status === 'tripwire' && 'bg-amber-900/40 border-amber-500/20',
            status === 'suspended' && 'bg-accent3Dark',
            status === 'waiting' && 'bg-accent5Dark',
            status === 'running' && 'bg-accent6Dark',
          )}
        >
          {onShowNestedGraph && <Button onClick={onShowNestedGraph}>View nested graph</Button>}
          {showTimeTravel && (
            <>
              <Button onClick={() => setIsTimeTravelOpen(true)}>Time travel</Button>
              <Dialog open={isTimeTravelOpen} onOpenChange={setIsTimeTravelOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>Time travel to {stepKey}</DialogTitle>

                  <div className="px-4 overflow-scroll max-h-[600px]">
                    <WorkflowTimeTravelForm stepKey={stepKey} closeModal={() => setIsTimeTravelOpen(false)} />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {mapConfig && (
            <>
              <Button onClick={() => setIsMapConfigOpen(true)}>Map config</Button>

              <Dialog open={isMapConfigOpen} onOpenChange={setIsMapConfigOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>
                    <div className="flex flex-col gap-1">
                      <div>{stepName} Map Config</div>
                      {stepId && stepId !== stepName && <div className="text-xs text-icon3 font-normal">{stepId}</div>}
                    </div>
                  </DialogTitle>

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

          {(output ?? suspendOutput) && (
            <>
              <Button onClick={() => setIsOutputOpen(true)}>Output</Button>

              <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} output</DialogTitle>
                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent data={output ?? suspendOutput} />
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

          {tripwire && (
            <>
              <Button onClick={() => setIsTripwireOpen(true)} className="text-amber-400 hover:text-amber-300">
                Tripwire
              </Button>

              <Dialog open={isTripwireOpen} onOpenChange={setIsTripwireOpen}>
                <DialogContent className={dialogContentClass}>
                  <DialogTitle className={dialogTitleClass}>{stepName} tripwire</DialogTitle>

                  <div className="px-4 overflow-hidden">
                    <CodeDialogContent
                      data={{
                        reason: tripwire.message,
                        retry: tripwire.options?.retry,
                        metadata: tripwire.options?.metadata,
                        processorId: tripwire.processorId,
                      }}
                    />
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
