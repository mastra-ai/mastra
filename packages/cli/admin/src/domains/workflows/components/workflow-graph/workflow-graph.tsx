'use client';

import type { ActionWithParentCondition, WorkflowAction, Blueprint, WorkflowTrigger } from '@mastra/core';
import { Fragment, useState } from 'react';

import { extractConditions } from '../../utils';

import { NewWorkflowActionBlock } from './new-workflow-action';
import { ActionBlock } from './workflow-action';
import { ConditionsBlock } from './workflow-conditions';
import { TriggerBlock } from './workflow-event';
import { WorkflowPopupActionsBar } from './workflow-popup-actions-bar';

export type WorkflowGraphProps = {
  blueprint: Blueprint;
};

export function WorkflowGraph({ blueprint }: WorkflowGraphProps) {
  const [scale, setScale] = useState(1);
  const trigger = blueprint?.trigger as unknown as WorkflowTrigger;

  return (
    <div className="mb-24 h-full p-5">
      <div className="flex h-full min-w-min flex-col items-center justify-center" style={{ scale }}>
        {/*this renders the trigger event block*/}
        <TriggerBlock trigger={trigger} />
        {blueprint.actions?.length ? (
          renderActions(blueprint.actions as unknown as WorkflowAction[])
        ) : (
          <>
            <div className="flex flex-col items-center">
              <NewWorkflowActionBlock />
            </div>
          </>
        )}
      </div>
      <WorkflowPopupActionsBar scale={scale} setScale={setScale} />
    </div>
  );
}

const renderActions = (actions: ActionWithParentCondition[]) => {
  return (
    <>
      <div className="my-class flex">
        {actions.map((action, index) => {
          const subActions = action?.subActions || [];
          const actionCondition = !!action?.parentCondition
            ? action?.parentCondition
            : Array.isArray(action?.condition)
            ? undefined
            : action?.condition;
          const conditions = extractConditions(actionCondition);
          const logicConditions = Array.isArray(action?.condition)
            ? action?.condition?.filter(({ actionId }) => !!actionId) //get conditions that have an action attached first
            : [];

          let subActionsAndConditions = subActions?.map(subact => ({
            ...subact,
          }));

          if (logicConditions.length) {
            const customConditions = logicConditions.filter(condition => !condition.isDefault);
            const defaultCondition = logicConditions.find(condition => condition.isDefault);

            const customSubActionsAndConditions = customConditions.map(item => {
              const subAct = subActions.find(subAct => subAct.id === item.actionId)!;
              return {
                ...subAct,
                parentCondition: item,
              };
            });

            const defaultSubActionsAndConditions = subActions.find(subAct => subAct.id === defaultCondition?.actionId);

            subActionsAndConditions = [
              ...customSubActionsAndConditions,
              ...(defaultSubActionsAndConditions
                ? [{ ...defaultSubActionsAndConditions, parentCondition: defaultCondition! }]
                : []),
            ];
          }

          return (
            <Fragment key={action.id}>
              <div className="flex flex-col items-center">
                {/*this renders the condition attached to an action*/}
                {conditions.length > 0 && (
                  <ConditionsBlock
                    conditions={conditions}
                    parentActionId={action.parentActionId!}
                    conditionGroup={action.parentCondition!}
                    index={index}
                    noOfActions={actions?.length}
                  />
                )}
                {/*this renders the action block*/}
                <ActionBlock action={action} />
                {subActionsAndConditions.length > 0 ? renderActions(subActionsAndConditions) : null}
              </div>
              {index < actions.length - 1 && (
                <div role="presentation" className="border-mastra-el-1 -mt-3 w-7 border-t" />
              )}
            </Fragment>
          );
        })}
      </div>
    </>
  );
};
