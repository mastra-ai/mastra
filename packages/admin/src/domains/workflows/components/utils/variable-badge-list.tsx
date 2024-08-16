import { capitalize } from 'lodash';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { useWorkflowContext } from '@/domains/workflows/context/workflow-context';
import { ActionVariables } from '@/domains/workflows/types';
import { getOutputSchema } from '@/domains/workflows/utils';

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
  const { actions, selectedBlock, frameworkEvent, trigger, frameworkActions } = useWorkflowContext();
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

  const resolvedTriggerSchema = getOutputSchema({
    block: frameworkEvent!,
    payload: trigger.payload!,
    blockType: 'trigger',
  });

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="">
        <DropdownMenuLabel>Blocks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!!frameworkEvent && (
          <>
            <DropdownMenuGroup>
              {renderSubMenu({
                title: frameworkEvent.label,
                schema: resolvedTriggerSchema,
                blockId: trigger.id,
                handleSelectPath,
                path: [],
                variablePayload,
                variable,
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        {parentActionIds.map(actionId => {
          const action = actions[actionId];
          const concreteAction = frameworkActions.find(frameworkAction => frameworkAction.type === action.type);

          if (action.type === 'CONDITIONS' || !concreteAction?.outputSchema) return;

          const resolvedSchema = getOutputSchema({
            block: concreteAction,
            payload: action.payload!,
            blockType: 'action',
          });

          return (
            <DropdownMenuGroup key={action.id}>
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
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{capitalize(title)}</DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
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
              <DropdownMenuCheckboxItem
                checked={checked}
                key={field}
                onCheckedChange={() => {}}
                onSelect={() => {
                  handleSelectPath({ path: newPath.join('.'), blockId });
                }}
              >
                {capitalize(field)}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
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
