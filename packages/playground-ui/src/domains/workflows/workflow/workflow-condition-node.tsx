import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Fragment, useState } from 'react';

import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

import type { Condition } from './utils';
import { Highlight, themes } from 'prism-react-renderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ChevronDown } from 'lucide-react';
import { getConditionIconAndColor } from './workflow-node-badges';
import { Dialog, DialogContent, DialogTitle } from '@/ds/components/Dialog';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useCurrentRun } from '../context/use-current-run';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { WorkflowStepActionBar } from './workflow-step-action-bar';

export type ConditionNode = Node<
  {
    conditions: Condition[];
    withoutTopHandle?: boolean;
    previousStepId: string;
    nextStepId: string;
    mapConfig?: string;
  },
  'condition-node'
>;

export function WorkflowConditionNode({ data }: NodeProps<ConditionNode>) {
  const { conditions, previousStepId, nextStepId, withoutTopHandle } = data;
  const [open, setOpen] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const type = conditions[0]?.type;
  const isCollapsible = (conditions.some(condition => condition.fnString) || conditions?.length > 1) && type !== 'else';

  const { steps } = useCurrentRun();

  const previousStep = steps[previousStepId];
  const nextStep = steps[nextStepId];

  // Check if previous step is a tripwire (failed step with tripwire property)
  const isPreviousTripwire = previousStep?.status === 'failed' && previousStep?.tripwire !== undefined;
  const previousDisplayStatus = isPreviousTripwire ? 'tripwire' : previousStep?.status;

  const { icon: IconComponent, color } = getConditionIconAndColor(type);

  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}

      <div
        data-workflow-node
        data-workflow-step-status={previousDisplayStatus}
        data-testid="workflow-condition-node"
        className={cn(
          'bg-surface3 rounded-lg w-[300px] border-sm border-border1',
          previousDisplayStatus === 'success' && nextStep && 'bg-accent1Darker',
          previousDisplayStatus === 'failed' && nextStep && 'bg-accent2Darker',
          previousDisplayStatus === 'tripwire' && nextStep && 'bg-amber-950/40 border-amber-500/30',
          !previousStep && Boolean(nextStep?.status) && 'bg-accent1Darker',
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
            <Badge
              icon={
                IconComponent ? (
                  <IconComponent className="text-current" {...(color ? { style: { color } } : {})} />
                ) : null
              }
            >
              {type?.toUpperCase()}
            </Badge>
            {isCollapsible && (
              <Icon>
                <ChevronDown
                  className={cn('transition-transform text-neutral3', {
                    'transform rotate-180': open,
                  })}
                />
              </Icon>
            )}
          </CollapsibleTrigger>

          {type === 'else' ? null : (
            <CollapsibleContent className="flex flex-col gap-2 pb-2">
              {conditions.map((condition, index) => {
                // Compute the conjunction badge for ref-based conditions
                const conjType = condition.conj || type;
                const { icon: ConjIconComponent, color: conjColor } = getConditionIconAndColor(conjType);
                const conjBadge =
                  index === 0 ? null : (
                    <Badge
                      icon={
                        ConjIconComponent ? (
                          <ConjIconComponent
                            className="text-current"
                            {...(conjColor ? { style: { color: conjColor } } : {})}
                          />
                        ) : null
                      }
                    >
                      {condition.conj?.toLocaleUpperCase() || 'WHEN'}
                    </Badge>
                  );

                return condition.fnString ? (
                  <div key={`${condition.fnString}-${index}`} className="px-3">
                    <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
                      {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                          className={cn(
                            'relative font-mono p-3 w-full cursor-pointer rounded-lg text-xs !bg-surface4 whitespace-pre-wrap break-words',
                            className,
                            previousDisplayStatus === 'success' && nextStep && '!bg-accent1Dark',
                            previousDisplayStatus === 'failed' && nextStep && '!bg-accent2Dark',
                            previousDisplayStatus === 'tripwire' && nextStep && '!bg-amber-900/40',
                          )}
                          onClick={() => setOpenDialog(true)}
                          style={style}
                        >
                          {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })}>
                              <span className="inline-block mr-2 text-neutral3">{i + 1}</span>
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
                                    <span className="inline-block mr-2 text-neutral3">{i + 1}</span>
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
                        {conjBadge}

                        <Txt variant="ui-xs" className=" text-neutral3 flex-1">
                          {(condition.ref.step as any).id || condition.ref.step}'s {condition.ref.path}{' '}
                          {Object.entries(condition.query).map(([key, value]) => `${key} ${String(value)}`)}
                        </Txt>
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
          tripwire={isPreviousTripwire ? previousStep?.tripwire : undefined}
          status={nextStep ? previousDisplayStatus : undefined}
        />
      </div>

      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </>
  );
}
