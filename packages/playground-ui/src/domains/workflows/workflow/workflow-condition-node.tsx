import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Fragment, useState } from 'react';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import type { Condition } from './utils';
import { Highlight, themes } from 'prism-react-renderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export type ConditionNode = Node<
  {
    conditions: Condition[];
  },
  'condition-node'
>;

export function WorkflowConditionNode({ data }: NodeProps<ConditionNode>) {
  const { conditions } = data;
  const [open, setOpen] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const type = conditions[0]?.type;
  const isCollapsible = (conditions.some(condition => condition.fnString) || conditions?.length > 1) && type !== 'else';

  return (
    <Collapsible
      open={!isCollapsible ? true : open}
      onOpenChange={_open => {
        if (isCollapsible) {
          setOpen(_open);
        }
      }}
      className={cn('bg-mastra-bg-3 rounded-md w-[274px] flex flex-col p-2 gap-2')}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      <CollapsibleTrigger className="flex items-center justify-between w-full">
        <Text
          size={'xs'}
          weight="medium"
          className="text-mastra-el-3 bg-mastra-bg-11 my-auto block rounded-[0.125rem] px-2 py-1 text-[10px] w-fit"
        >
          {type?.toUpperCase()}
        </Text>
        {isCollapsible && (
          <ChevronDown
            className={cn('w-4 h-4 transition-transform', {
              'transform rotate-180': open,
            })}
          />
        )}
      </CollapsibleTrigger>
      {type === 'else' ? null : (
        <CollapsibleContent className="flex flex-col gap-2">
          {conditions.map((condition, index) => {
            return condition.fnString ? (
              <Fragment key={`${condition.fnString}-${index}`}>
                <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={`${className} relative font-mono text-sm overflow-x-auto p-3 w-full cursor-pointer rounded-lg mt-2`}
                      style={{
                        ...style,
                        backgroundColor: 'transparent',
                        border: '1px solid #343434',
                        maxHeight: '9.62rem',
                      }}
                      onClick={() => setOpenDialog(true)}
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
                  <DialogContent className="max-w-[30rem] bg-[#121212] p-[0.5rem]">
                    <ScrollArea className="w-full p-2" maxHeight="400px">
                      <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
                        {({ className, style, tokens, getLineProps, getTokenProps }) => (
                          <pre
                            className={`${className} relative font-mono text-sm overflow-x-auto p-3 w-full rounded-lg mt-2 dark:bg-zinc-800`}
                            style={{
                              ...style,
                              backgroundColor: '#121212',
                              border: '0.5px solid #131313',
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
              </Fragment>
            ) : (
              <Fragment key={`${condition.ref?.path}-${index}`}>
                {condition.ref?.step ? (
                  <div className="flex items-center gap-1">
                    {index === 0 ? null : (
                      <Text
                        size={'xs'}
                        weight="medium"
                        className="text-mastra-el-3 bg-mastra-bg-11 my-auto block rounded-[0.125rem] px-2 py-1 text-[10px]"
                      >
                        {condition.conj?.toLocaleUpperCase() || 'WHEN'}
                      </Text>
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
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </Collapsible>
  );
}
