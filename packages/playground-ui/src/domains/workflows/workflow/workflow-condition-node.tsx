import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Fragment } from 'react';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import type { Condition } from './utils';

export type ConditionNode = Node<
  {
    conditions: Condition[];
  },
  'condition-node'
>;

export function WorkflowConditionNode({ data }: NodeProps<ConditionNode>) {
  const { conditions } = data;
  return (
    <div className={cn('bg-mastra-bg-3 rounded-md min-w-[154.23px] max-w-[274px] flex flex-col p-2 gap-2')}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      {conditions.map((condition, index) => {
        return (
          <Fragment key={`${condition.ref.path}-${index}`}>
            {condition.ref.step ? (
              <div className="flex items-center gap-1">
                <Text
                  size={'xs'}
                  weight="medium"
                  className="text-mastra-el-3 bg-mastra-bg-11 my-auto block rounded-[0.125rem] px-2 py-1 text-[10px]"
                >
                  {condition.conj?.toLocaleUpperCase() || 'WHEN'}
                </Text>

                <Text size={'xs'} className=" text-mastra-el-3">
                  {(condition.ref.step as any).id || condition.ref.step}'s {condition.ref.path}{' '}
                  {Object.entries(condition.query).map(([key, value]) => (
                    <span className="flex items-center gap-0.5" key={`${key}-${value}`}>
                      <Text size={'xs'} className="lowercase">
                        {key}
                      </Text>
                      <Text size={'xs'}>{value}</Text>
                    </span>
                  ))}
                </Text>
              </div>
            ) : null}
          </Fragment>
        );
      })}
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
}
