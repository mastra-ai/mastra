import type { ActionVariables } from '@mastra/core';
import { capitalize } from 'lodash';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { useWorkflowContext } from '@/domains/workflows/context/workflow-context';
import { getActionOutputSchema, getTriggerOutputSchema } from '@/domains/workflows/utils';

export function BadgeDropDown({
  children,
  variable,
  variablePayload,
  handleUpdateVariablePayload,
}: {
  children: React.ReactNode;
  variable: string;
  variablePayload?: ActionVariables;
  handleUpdateVariablePayload: ({
    variable,
    refBlockId,
    path,
  }: {
    variable: string;
    refBlockId: string;
    path: string;
  }) => void;
}) {
  const { actions, selectedBlock, frameworkEvent, trigger, frameworkApis } = useWorkflowContext();
  const currentAction = actions[selectedBlock?.block.id || ''];

  let parentActionIds = [];
  let parentActionId = currentAction?.parentActionId;

  while (parentActionId) {
    parentActionIds.push(parentActionId);
    parentActionId = actions[parentActionId].parentActionId;
  }

  function handleSelectPath({ path, blockId }: { path: string; blockId: string }) {
    handleUpdateVariablePayload({ variable, refBlockId: blockId, path });
  }

  const resolvedTriggerSchema = getTriggerOutputSchema({
    block: frameworkEvent!,
    payload: trigger.payload!,
  });

  return (
    <Dropdown modal={false}>
      <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
      <Dropdown.Content className="">
        <Dropdown.Label>Blocks</Dropdown.Label>
        <Dropdown.Separator />
        {!!frameworkEvent && (
          <>
            <Dropdown.Group>
              {renderSubMenu({
                title: frameworkEvent?.label!,
                schema: resolvedTriggerSchema,
                blockId: trigger.id,
                handleSelectPath,
                path: [],
                variablePayload,
                variable,
              })}
            </Dropdown.Group>
            <Dropdown.Separator />
          </>
        )}
        {parentActionIds.map(actionId => {
          const action = actions[actionId];
          const concreteAction = frameworkApis.find(frameworkApi => frameworkApi.type === action.type);

          if (action.type === 'CONDITIONS' || !concreteAction?.outputSchema) return;

          const resolvedSchema = getActionOutputSchema({
            block: concreteAction,
            payload: action.payload!,
          });

          return (
            <Dropdown.Group key={action.id}>
              {!!concreteAction &&
                renderSubMenu({
                  title: concreteAction.label,
                  path: [],
                  schema: resolvedSchema,
                  blockId: action.id,
                  handleSelectPath,
                  variablePayload,
                  variable,
                })}
            </Dropdown.Group>
          );
        })}
      </Dropdown.Content>
    </Dropdown>
  );
}

export function renderSubMenu({
  title,
  schema,
  blockId,
  handleSelectPath,
  path,
  variablePayload,
  variable,
}: {
  title: string;
  path: string[];
  schema: z.ZodSchema<unknown>;
  blockId: string;
  variable: string;
  variablePayload?: ActionVariables;
  handleSelectPath: ({ path, blockId }: { path: string; blockId: string }) => void;
}) {
  return (
    <Dropdown.Sub>
      <Dropdown.SubTrigger>{capitalize(title)}</Dropdown.SubTrigger>
      <Dropdown.Portal>
        <Dropdown.SubContent>
          {Object.entries((schema as any)?.shape || {}).map(([field, schema]) => {
            const newPath = [...path, field];
            const currentPath = variablePayload?.[variable]?.path;
            const checked = variablePayload?.[variable]?.refBlockId === blockId && currentPath === newPath.join('.');

            if (schema instanceof z.ZodObject) {
              return renderSubMenu({
                title: field,
                schema,
                blockId,
                path: newPath,
                handleSelectPath,
                variable,
                variablePayload,
              });
            }
            return (
              <Dropdown.CheckboxItem
                checked={checked}
                key={field}
                onCheckedChange={() => {}}
                onSelect={() => {
                  handleSelectPath({ path: newPath.join('.'), blockId });
                }}
              >
                {capitalize(field)}
              </Dropdown.CheckboxItem>
            );
          })}
        </Dropdown.SubContent>
      </Dropdown.Portal>
    </Dropdown.Sub>
  );
}

function VariableBadgeList({
  variablePayload,
  variables,
  handleUpdateVariablePayload,
  className,
}: {
  variablePayload?: ActionVariables;
  handleUpdateVariablePayload: any;
  variables: string[];
  className?: string;
}) {
  return variables.length ? (
    <div className={cn('mt-2 flex flex-wrap gap-1.5', className)}>
      {variables.map(variable => {
        const hasAssignedVariable = !!variablePayload?.[variable];
        return (
          <BadgeDropDown
            key={variable}
            variable={variable}
            variablePayload={variablePayload}
            handleUpdateVariablePayload={handleUpdateVariablePayload}
          >
            <Button className="rounded bg-neutral-800 px-1.5 py-0.5 hover:bg-neutral-700" variant={'ghost'}>
              <span
                className={cn('mr-1.5 h-1.5 w-1.5 rounded-full bg-orange-300', {
                  'bg-green-500': hasAssignedVariable,
                })}
              ></span>

              <Text size="xs" weight="medium">
                {variable}
              </Text>
            </Button>
          </BadgeDropDown>
        );
      })}
    </div>
  ) : (
    <></>
  );
}

export default VariableBadgeList;
