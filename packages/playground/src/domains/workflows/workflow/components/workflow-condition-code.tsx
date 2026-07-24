import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Highlight, themes } from 'prism-react-renderer';

import type { WorkflowConditionCodeCondition } from './types';

export interface WorkflowConditionCodeProps {
  condition: WorkflowConditionCodeCondition;
  onOpen: () => void;
}

export const WorkflowConditionCode = ({ condition, onOpen }: WorkflowConditionCodeProps) => (
  <div className="px-3">
    <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            'relative font-mono p-3 w-full cursor-pointer rounded-lg text-xs bg-surface4! whitespace-pre-wrap wrap-break-word',
            className,
          )}
          onClick={onOpen}
          style={style}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              <span className="text-neutral3 mr-2 inline-block">{i + 1}</span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  </div>
);

export interface WorkflowConditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condition?: WorkflowConditionCodeCondition;
}

export const WorkflowConditionDialog = ({ open, onOpenChange, condition }: WorkflowConditionDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[30rem]">
      <DialogHeader>
        <DialogTitle className="sr-only">Condition Function</DialogTitle>
        <DialogDescription>View the condition function code</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ScrollArea className="w-full" maxHeight="400px">
          {condition && (
            <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  className={`${className} relative mt-2 w-full overflow-x-auto rounded-lg p-3 font-mono text-sm dark:bg-zinc-800`}
                  style={{
                    ...style,
                    backgroundColor: '#121212',
                    padding: '0 0.75rem 0 0',
                  }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      <span className="text-neutral3 mr-2 inline-block">{i + 1}</span>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          )}
        </ScrollArea>
      </DialogBody>
    </DialogContent>
  </Dialog>
);
