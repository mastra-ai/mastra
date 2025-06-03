import { DialogTitle } from '@/components/ui/dialog';
import { DialogContent } from '@/components/ui/dialog';
import { Button } from '@/ds/components/Button';
import { Dialog } from '@/components/ui/dialog';
import { CodeDialogContent } from './workflow-code-dialog-content';
import { useState } from 'react';

export interface WorkflowStepActionBarProps {
  input?: any;
  output?: any;
  error?: any;
  stepName: string;
  mapConfig?: string;
  onShowTrace?: () => void;
}

export const WorkflowStepActionBar = ({
  input,
  output,
  error,
  mapConfig,
  stepName,
  onShowTrace,
}: WorkflowStepActionBarProps) => {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isMapConfigOpen, setIsMapConfigOpen] = useState(false);

  const dialogContentClass = 'bg-surface2 rounded-lg border-sm border-border1 max-w-4xl w-full px-0';
  const dialogTitleClass = 'border-b-sm border-border1 pb-4 px-6';

  return (
    <>
      {(input || output || error || mapConfig) && (
        <div className="flex flex-wrap items-center bg-surface4 border-t-sm border-border1 px-2 py-1 gap-2 rounded-b-lg">
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
        </div>
      )}
    </>
  );
};
