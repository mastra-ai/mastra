import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CircleDashed, Loader2, PauseIcon } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { useCurrentRun } from '../context/use-current-run';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { jsonLanguage } from '@codemirror/lang-json';
import clsx from 'clsx';
import { useEffect } from 'react';
import { useState } from 'react';
import { toSigFigs } from '@/lib/number';
import { CopyButton } from '@/components/ui/copy-button';

export type DefaultNode = Node<
  {
    label: string;
    description?: string;
    withoutTopHandle?: boolean;
    withoutBottomHandle?: boolean;
  },
  'default-node'
>;

export function WorkflowDefaultNode({ data }: NodeProps<DefaultNode>) {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);

  const { steps, isRunning } = useCurrentRun();
  const { label, description, withoutTopHandle, withoutBottomHandle } = data;

  const step = steps[label];

  const dialogContentClass = 'bg-surface2 rounded-lg border-sm border-border1 max-w-4xl w-full px-0';
  const dialogTitleClass = 'border-b-sm border-border1 pb-4 px-6';

  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}

      <div
        className={clsx(
          'bg-surface3 rounded-lg w-[274px] border-sm border-border1 pt-2',
          step?.status === 'success' && 'ring-2 ring-accent1',
          step?.status === 'failed' && 'ring-2 ring-accent2',
        )}
      >
        <div className="flex items-center gap-2 px-3">
          {isRunning && (
            <Icon>
              {step?.status === 'failed' && <CrossIcon className="text-accent2" />}
              {step?.status === 'success' && <CheckIcon className="text-accent1" />}
              {step?.status === 'suspended' && <PauseIcon className="text-icon3" />}
              {step?.status === 'running' && <Loader2 className="text-icon6 animate-spin" />}
              {!step && <CircleDashed className="text-icon2" />}
            </Icon>
          )}
          <Txt variant="ui-lg" className="text-icon6 font-medium inline-flex items-center gap-1 justify-between w-full">
            {label} {step?.startedAt && <Clock startedAt={step.startedAt} endedAt={step.endedAt} />}
          </Txt>
        </div>

        {description && (
          <Txt variant="ui-sm" className="text-icon3 px-3 pb-2">
            {description}
          </Txt>
        )}

        {(step?.input || step?.output) && (
          <div className="flex items-center bg-surface4 border-t-sm border-border1 px-2 py-1 gap-2">
            {step?.input && (
              <>
                <Button onClick={() => setIsInputOpen(true)}>Input</Button>

                <Dialog open={isInputOpen} onOpenChange={setIsInputOpen}>
                  <DialogContent className={dialogContentClass}>
                    <DialogTitle className={dialogTitleClass}>{label} input</DialogTitle>

                    <div className="px-4 overflow-hidden">
                      <CodeDialogContent data={step.input} />
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {step?.output && (
              <>
                <Button onClick={() => setIsOutputOpen(true)}>Output</Button>

                <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                  <DialogContent className={dialogContentClass}>
                    <DialogTitle className={dialogTitleClass}>{label} output</DialogTitle>
                    <div className="px-4 overflow-hidden">
                      <CodeDialogContent data={step.output} />
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {step?.error && (
              <>
                <Button onClick={() => setIsErrorOpen(true)}>Error</Button>

                <Dialog open={isErrorOpen} onOpenChange={setIsErrorOpen}>
                  <DialogContent className={dialogContentClass}>
                    <DialogTitle className={dialogTitleClass}>{label} error</DialogTitle>

                    <div className="px-4 overflow-hidden">
                      <CodeDialogContent data={step?.error} />
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}
      </div>

      {!withoutBottomHandle && (
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', color: 'red' }} />
      )}
    </>
  );
}

const CodeDialogContent = ({ data }: { data: any }) => {
  const theme = useCodemirrorTheme();

  if (typeof data !== 'string') {
    return (
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={JSON.stringify(data, null, 2)} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={JSON.stringify(data, null, 2)} theme={theme} extensions={[jsonLanguage]} />
        </div>
      </div>
    );
  }

  try {
    const json = JSON.parse(data);
    return (
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={data} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={json} theme={theme} extensions={[jsonLanguage]} />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="max-h-[500px] overflow-auto relative p-4">
        <div className="absolute right-2 top-2 bg-surface4 rounded-full z-10">
          <CopyButton content={data} />
        </div>
        <div className="bg-surface4 rounded-lg p-4">
          <CodeMirror value={data} theme={theme} extensions={[]} />
        </div>
      </div>
    );
  }
};

interface ClockProps {
  startedAt: number;
  endedAt?: number;
}
const Clock = ({ startedAt, endedAt }: ClockProps) => {
  const [time, setTime] = useState(startedAt);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [startedAt]);

  const timeDiff = endedAt ? endedAt - startedAt : time - startedAt;

  return <span className="text-xs text-icon3">{toSigFigs(timeDiff, 3)}ms</span>;
};
