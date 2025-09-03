import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Fragment, useState } from 'react';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import type { Condition } from './utils';
import { Highlight, themes } from 'prism-react-renderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Network } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentRun } from '../context/use-current-run';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { WorkflowStepActionBar } from './workflow-step-action-bar';

export type ConditionNode = Node<
  {
    conditions: Condition[];
    previousStepId: string;
    nextStepId: string;
    mapConfig?: string;
  },
  'condition-node'
>;

export function WorkflowConditionNode({ data }: NodeProps<ConditionNode>) {
  const { conditions, previousStepId, nextStepId } = data;
  const [open, setOpen] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const type = conditions[0]?.type;
  const isCollapsible = (conditions.some(condition => condition.fnString) || conditions?.length > 1) && type !== 'else';

  const { steps } = useCurrentRun();

  const previousStep = steps[previousStepId];
  const nextStep = steps[nextStepId];

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      <div
        className={cn(
          'bg-surface3 rounded-lg w-[300px] border-sm border-border1',
          previousStep?.status === 'success' && nextStep && 'bg-accent1Darker',
          previousStep?.status === 'failed' && nextStep && 'bg-accent2Darker',
        )}
      >
        <Collapsible
          open={!isCollapsible ? true : open}
          onOpenChange={_open => {
            if (isCollapsible) {
              setOpen(_open);
            }
          }}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2">
            <Badge icon={type === 'when' ? <Network className="text-[#ECB047]" /> : null}>{type?.toUpperCase()}</Badge>
            {isCollapsible && (
              <Icon>
                <ChevronDown
                  className={cn('transition-transform text-icon3', {
                    'transform rotate-180': open,
                  })}
                />
              </Icon>
            )}
          </CollapsibleTrigger>

          {type === 'else' ? null : (
            <CollapsibleContent className="flex flex-col gap-2 pb-2">
              {conditions.map((condition, index) => {
                return condition.fnString ? (
                  <div key={`${condition.fnString}-${index}`} className="px-3">
                    <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
                      {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                          className={cn(
                            'relative font-mono p-3 w-full cursor-pointer rounded-lg text-xs !bg-surface4 overflow-scroll',
                            className,
                            previousStep?.status === 'success' && nextStep && '!bg-accent1Dark',
                            previousStep?.status === 'failed' && nextStep && '!bg-accent2Dark',
                          )}
                          onClick={() => setOpenDialog(true)}
                          style={style}
                        >
                          {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })}>
                              <span className="inline-block mr-2 text-muted-foreground">{i + 1}</span>
                              {line.map((token, key) => (
                                <span key={key} {...getTokenProps({ token })} />
                              ))}
                            </div>
                          ))}
                        </pre>
                      )}
                    </Highlight>

                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                      <DialogContent className="max-w-[30rem] bg-surface2 p-4">
                        <DialogTitle className="sr-only">Condition Function</DialogTitle>
                        <ScrollArea className="w-full p-2 pt-4" maxHeight="400px">
                          <Highlight
                            theme={themes.oneDark}
                            code={String(condition.fnString).trim()}
                            language="javascript"
                          >
                            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                              <pre
                                className={`${className} relative font-mono text-sm overflow-x-auto p-3 w-full rounded-lg mt-2 dark:bg-zinc-800`}
                                style={{
                                  ...style,
                                  backgroundColor: '#121212',
                                  padding: '0 0.75rem 0 0',
                                }}
                              >
                                {tokens.map((line, i) => (
                                  <div key={i} {...getLineProps({ line })}>
                                    <span className="inline-block mr-2 text-muted-foreground">{i + 1}</span>
                                    {line.map((token, key) => (
                                      <span key={key} {...getTokenProps({ token })} />
                                    ))}
                                  </div>
                                ))}
                              </pre>
                            )}
                          </Highlight>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                ) : (
                  <Fragment key={`${condition.ref?.path}-${index}`}>
                    {condition.ref?.step ? (
                      <div className="flex items-center gap-1">
                        {index === 0 ? null : (
                          <Badge icon={<Network className="text-[#ECB047]" />}>
                            {condition.conj?.toLocaleUpperCase() || 'WHEN'}
                          </Badge>
                        )}

                        <Text size={'xs'} className=" text-mastra-el-3 flex-1">
                          {(condition.ref.step as any).id || condition.ref.step}'s {condition.ref.path}{' '}
                          {Object.entries(condition.query).map(([key, value]) => `${key} ${String(value)}`)}
                        </Text>
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
            </CollapsibleContent>
          )}
        </Collapsible>

        <WorkflowStepActionBar
          stepName={nextStepId}
          input={previousStep?.output}
          mapConfig={data.mapConfig}
          status={nextStep ? previousStep?.status : undefined}
        />
      </div>

      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </>
  );
}
