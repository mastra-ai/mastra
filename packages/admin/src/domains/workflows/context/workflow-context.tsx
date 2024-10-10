'use client';

import { RefinedIntegrationApi, RefinedIntegrationEvent } from '@mastra/core/dist/types';
import {
  type NewActionInMiddleProps,
  type UpdateLogicCondtion,
  type WorkflowContextAction,
  type WorkflowContextBlueprintInfo,
  type WorkflowContextSelectedBlock,
  type WorkflowContextWorkflowActionsShape,
  type WorkflowAction,
  type WorkflowTrigger,
  type Blueprint,
  type UpdateTrigger,
  type WorkflowLogicConditionGroup,
} from '@mastra/core/dist/workflows/types';
import { createId } from '@paralleldrive/cuid2';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useParams } from 'next/navigation';

import useLocalStorage from '@/lib/hooks/use-local-storage';
import { isObjectEmpty } from '@/lib/object';

import { systemLogics } from '../constants';
import { WorkflowStatusEnum } from '../types';
import {
  constructBluePrint,
  constructWorkflowContextBluePrint,
  getParsedFrameworkApis,
  getParsedFrameworkEvents,
  isActionPayloadValid,
  isTriggerPayloadValid,
} from '../utils';

export interface WorkflowContextProps {
  blueprintId: string;
  blueprintInfo: WorkflowContextBlueprintInfo;

  trigger: WorkflowTrigger;
  actions: WorkflowContextWorkflowActionsShape;

  updateBlueprintInfo: (info: WorkflowContextBlueprintInfo) => void;
  setBlueprintInfo: (info: WorkflowContextBlueprintInfo) => void;

  updateTrigger: (trigger: UpdateTrigger) => void;
  setTrigger: (trigger: UpdateTrigger) => void;

  updateAction: (action: WorkflowContextAction, removeActionId?: string) => Blueprint;
  removeAction: (actionId: string, deleteOnlyBlock?: boolean) => Blueprint;

  updateLogicActionCondition: ({ actionId, condition, isNewCondition }: UpdateLogicCondtion) => Blueprint;
  setActions: (actions: WorkflowContextWorkflowActionsShape) => void;

  frameworkApis: RefinedIntegrationApi[];
  frameworkApi?: RefinedIntegrationApi;

  frameworkEvents: RefinedIntegrationEvent[];
  frameworkEvent?: RefinedIntegrationEvent;

  constructedBlueprint: Blueprint;
  currentLocalBlueprint: Blueprint;

  localBlueprints: Record<string, Blueprint>;
  selectedBlock: WorkflowContextSelectedBlock | undefined;

  setSelectedBlock: (block: WorkflowContextSelectedBlock | undefined) => void;
  addNewBlankAction: (props: NewActionInMiddleProps) => Blueprint;

  actionsValidityObject: Record<string, { isValid: boolean; message: string }>;
  isTriggerValid: boolean;
  attemptedPublish: boolean;

  setAttempedPublish: (attempted: boolean) => void;
  updateLocalBlueprint: (newblueprint: Blueprint, isResetting?: boolean) => void;
}

export const WorkflowContext = createContext({} as WorkflowContextProps);

export const useWorkflowContext = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflowContext must be used within a WorkflowProvider');
  }
  return context;
};

export const WorkflowProvider = ({
  children,
  serializedFrameworkApis,
  serializedFrameworkEvents,
}: {
  children: React.ReactNode;
  serializedFrameworkApis: string;
  serializedFrameworkEvents: string;
}) => {
  const blueprintId = useParams()?.blueprintId as string;
  const [localBlueprints, setLocalBlueprints] = useLocalStorage<Record<string, Blueprint>>('blueprints', {});
  const [blueprintInfo, setBlueprintInfo] = useState<WorkflowContextBlueprintInfo>({} as WorkflowContextBlueprintInfo);
  const [trigger, setTrigger] = useState<WorkflowTrigger>({} as WorkflowTrigger);
  const [actions, setActions] = useState<WorkflowContextWorkflowActionsShape>(
    {} as WorkflowContextWorkflowActionsShape,
  );
  const [selectedBlock, setSelectedBlock] = useState<WorkflowContextSelectedBlock | undefined>();
  const [isTriggerValid, setIsTriggerValid] = useState(false);
  const [actionsValidityObject, setActionsValidityObject] = useState<
    Record<string, { isValid: boolean; message: string }>
  >({});
  const [newActionCond, setNewActionCond] = useState<{ actionId: string; condId: string }>();
  const [attemptedPublish, setAttempedPublish] = useState(false);

  const currentLocalBlueprint = localBlueprints[blueprintId];

  const frameworkApis = useMemo(() => {
    return getParsedFrameworkApis(serializedFrameworkApis);
  }, [serializedFrameworkApis]);

  const frameworkApi = useMemo(() => {
    return frameworkApis.find(api => api.type === (selectedBlock?.block as WorkflowAction)?.type);
  }, [frameworkApis, selectedBlock?.block]);

  const frameworkEvents = useMemo(() => {
    return getParsedFrameworkEvents(serializedFrameworkEvents);
  }, [serializedFrameworkEvents]);

  const frameworkEvent = useMemo(() => {
    return frameworkEvents.find(event => event?.key === trigger?.type);
  }, [trigger, frameworkEvents]);

  const updateLocalBlueprint = useCallback(
    (newblueprint: Blueprint, isResetting?: boolean) => {
      setLocalBlueprints({
        ...localBlueprints,
        [blueprintId]: {
          ...newblueprint,
          ...(isResetting ? {} : { updatedAt: new Date(), status: WorkflowStatusEnum.DRAFT }),
        },
      });
    },
    [blueprintId, localBlueprints, setLocalBlueprints],
  );

  const handleSetTrigger = useCallback(
    (newTrigger: UpdateTrigger) => {
      setTrigger(newTrigger as WorkflowTrigger);
      if (!newTrigger || isObjectEmpty(newTrigger)) {
        setSelectedBlock({
          type: 'trigger',
          block: newTrigger as WorkflowTrigger,
        });
      } else {
        setSelectedBlock(undefined);
        const triggerBlock = frameworkEvents.find(event => event?.key === newTrigger.type);
        const isValid = isTriggerPayloadValid({ trigger: newTrigger as WorkflowTrigger, block: triggerBlock! });
        setIsTriggerValid(isValid);
      }
    },
    [frameworkEvents],
  );

  const handleSetActions = useCallback(
    (newActions: WorkflowContextWorkflowActionsShape) => {
      setActions(newActions);
      const actionsValidity = Object.values(newActions)?.map(action => {
        if (!action.type) {
          return { id: action.id, isValid: { isValid: false, message: 'No action type selected' } };
        }
        const concreteAction =
          frameworkApis.find(systemAction => systemAction.type === action.type) ||
          systemLogics.find(systemLogic => systemLogic.type === action.type);

        const isValid = isActionPayloadValid({
          action: action as WorkflowAction,
          block: concreteAction as RefinedIntegrationApi,
        });

        return { id: action.id, isValid };
      });

      const actionsValidityObj = actionsValidity?.reduce((acc, b) => {
        return { ...acc, [b.id]: b.isValid };
      }, {} as Record<string, { isValid: boolean; message: string }>);

      setActionsValidityObject(actionsValidityObj);
    },
    [frameworkApis],
  );

  const handleUpdateTrigger = useCallback(
    (updatedTrigger: UpdateTrigger) => {
      const newTrigger = { ...trigger, ...updatedTrigger };
      setTrigger(newTrigger);
      const isValid = isTriggerPayloadValid({ trigger: newTrigger as WorkflowTrigger, block: frameworkEvent! });
      setIsTriggerValid(isValid);
      if (selectedBlock?.type === 'trigger') {
        setSelectedBlock({
          type: 'trigger',
          block: newTrigger,
        });
      }

      const constuctedBlueprint = constructBluePrint({
        blueprintInfo,
        trigger: newTrigger,
        actions,
      });

      updateLocalBlueprint(constuctedBlueprint);
    },
    [trigger, selectedBlock, frameworkEvent, blueprintInfo, actions, updateLocalBlueprint],
  );

  const handleUpdateBlueprintInfo = useCallback(
    (info: WorkflowContextBlueprintInfo) => {
      setBlueprintInfo(prev => ({ ...prev, ...info }));
      const constuctedBlueprint = constructBluePrint({
        blueprintInfo: { ...blueprintInfo, ...info },
        trigger,
        actions,
      });

      updateLocalBlueprint(constuctedBlueprint, true);
    },
    [updateLocalBlueprint, trigger, actions, blueprintInfo],
  );

  const handleUpdateAction = useCallback(
    (action: WorkflowContextAction, removeActionId?: string) => {
      const newAction = {
        ...(actions[action.id] || {}),
        ...action,
      };
      const subActions = Object.values(actions).filter(val => val.parentActionId === action.id);
      const isChangingType = actions[action.id]?.type !== 'CONDITIONS';
      const isAddingNew = !actions[action.id]?.type;
      const isConditionActionType = action.type === 'CONDITIONS' && (isChangingType || isAddingNew);
      let newSubActions: WorkflowContextWorkflowActionsShape = {};
      if (isConditionActionType) {
        const conditionId1 = createId();
        const conditionId2 = createId();
        const defaultConditionId = createId();
        const actionId1 = createId();
        const actionId2 = createId();
        newSubActions = {
          [actionId1]: {
            id: actionId1,
            type: '',
            parentActionId: newAction.id,
          },
          [actionId2]: {
            id: actionId2,
            type: '',
            parentActionId: newAction.id,
          },
        };
        newAction.condition = [
          { field: '', operator: '', blockId: '', actionId: actionId1, id: conditionId1 },
          { field: '', operator: '', blockId: '', actionId: actionId2, id: conditionId2 },
          {
            field: '',
            operator: '',
            blockId: '',
            actionId: subActions?.[0]?.id || '',
            isDefault: true,
            id: defaultConditionId,
          },
        ];
      }

      const updatedActions = {
        ...actions,
        [action.id]: newAction,
        ...newSubActions,
      };

      const concreteAction =
        frameworkApis.find(systemAction => systemAction.type === newAction.type) ||
        systemLogics.find(systemLogic => systemLogic.type === newAction.type);

      const isValid = isActionPayloadValid({
        action: newAction as WorkflowAction,
        block: concreteAction as RefinedIntegrationApi,
      });

      setActionsValidityObject(prev => ({ ...prev, [action.id]: isValid }));
      const actionToRemove = updatedActions[removeActionId || ''];

      if (removeActionId) {
        delete updatedActions[removeActionId];
      }

      const constuctedBlueprint = constructBluePrint({
        blueprintInfo,
        trigger,
        actions: updatedActions,
      });
      const { actions: correctActions } = constructWorkflowContextBluePrint(constuctedBlueprint);
      setActions(correctActions);
      const removedActionParent = correctActions[actionToRemove?.parentActionId || ''];
      if (removedActionParent) {
        const parentConcreteAction =
          frameworkApis.find(systemAction => systemAction.type === removedActionParent.type) ||
          systemLogics.find(systemLogic => systemLogic.type === removedActionParent.type);

        const isRemovedActionParentValid = isActionPayloadValid({
          action: removedActionParent as WorkflowAction,
          block: parentConcreteAction as RefinedIntegrationApi,
        });

        setActionsValidityObject(prev => ({
          ...prev,
          [removedActionParent.id]: isRemovedActionParentValid,
          [action.id]: isValid,
        }));
      }
      if (selectedBlock?.type === 'action' && action.type === selectedBlock.block.type) {
        setSelectedBlock({
          type: 'action',
          block: { ...(selectedBlock.block || {}), ...newAction },
        });
      }

      updateLocalBlueprint(constuctedBlueprint);
      return constuctedBlueprint;
    },
    [actions, blueprintInfo, selectedBlock?.block, selectedBlock?.type, trigger, frameworkApis, updateLocalBlueprint],
  );

  const handleNewBlankAction = useCallback(
    ({ newAction, isParentATrigger, isParentACondition, conditionId }: NewActionInMiddleProps) => {
      let actionIdToUpdate = isParentATrigger
        ? Object.values(actions)?.find(act => !act.parentActionId)?.id
        : Object.values(actions)?.find(act => act.parentActionId === newAction.parentActionId)?.id;
      let updatedActions = {
        ...actions,
        [newAction.id]: newAction,
      };

      if (isParentACondition) {
        const parentAction = actions[newAction.parentActionId || ''];
        if (parentAction?.id) {
          const conditions = Array.isArray(parentAction?.condition) ? parentAction.condition : [];

          if (conditions.length) {
            const newConditions = conditions?.map(cond => {
              if (cond.id === conditionId) {
                actionIdToUpdate = cond.actionId;
                cond.actionId = newAction.id;
              }
              return cond;
            });

            updatedActions[parentAction.id] = { ...updatedActions[parentAction.id], condition: newConditions };

            setActionsValidityObject(prev => ({ ...prev, [parentAction.id]: { isValid: true, message: '' } }));
          }
        }
      }
      if (actionIdToUpdate && updatedActions[actionIdToUpdate]) {
        updatedActions[actionIdToUpdate] = { ...updatedActions[actionIdToUpdate], parentActionId: newAction.id };
      }
      setActions(updatedActions);

      setSelectedBlock({
        type: 'action',
        block: newAction as WorkflowAction,
      });

      const constuctedBlueprint = constructBluePrint({
        blueprintInfo,
        trigger,
        actions: updatedActions,
      });
      updateLocalBlueprint(constuctedBlueprint);
      return constuctedBlueprint;
    },
    [actions, blueprintInfo, trigger, updateLocalBlueprint],
  );

  const handleRemoveAction = useCallback(
    (actionId: string, deleteOnlyBlock?: boolean) => {
      const action = actions[actionId];
      const updatedActions = {
        ...actions,
      };

      if (deleteOnlyBlock) {
        const childAction = Object.values(actions)?.find(act => act.parentActionId === actionId);
        if (childAction) {
          updatedActions[childAction.id].parentActionId = action.parentActionId;
        }
      }

      delete updatedActions[actionId];

      if (action.parentActionId && actions[action.parentActionId]?.type === 'CONDITIONS') {
        const updatedParentConditions = (
          actions[action.parentActionId]?.condition as WorkflowLogicConditionGroup[]
        )?.map(cond => {
          if (cond.actionId === actionId) {
            cond.actionId = '';
          }

          return cond;
        });

        updatedActions[action.parentActionId].condition = updatedParentConditions;
      }

      const constuctedBlueprint = constructBluePrint({
        blueprintInfo,
        trigger,
        actions: updatedActions,
      });
      const { actions: correctActions } = constructWorkflowContextBluePrint(constuctedBlueprint);
      setActions(correctActions);
      const removedActionParent = correctActions[action.parentActionId || ''];
      if (removedActionParent) {
        const concreteAction =
          frameworkApis.find(systemAction => systemAction.type === removedActionParent.type) ||
          systemLogics.find(systemLogic => systemLogic.type === removedActionParent.type);

        const isValid = isActionPayloadValid({
          action: removedActionParent as WorkflowAction,
          block: concreteAction as RefinedIntegrationApi,
        });

        setActionsValidityObject(prev => ({ ...prev, [removedActionParent.id]: isValid }));
      }
      setSelectedBlock(undefined);
      updateLocalBlueprint(constuctedBlueprint);
      return constuctedBlueprint;
    },
    [actions, blueprintInfo, trigger, frameworkApis, updateLocalBlueprint],
  );

  const handleUpdateLogicActionCondition = useCallback(
    ({ actionId, condition, isNewCondition, isPathFromGraph }: UpdateLogicCondtion) => {
      const action = actions[actionId];
      const { condition: actionCondition } = action;
      const conditions = Array.isArray(actionCondition) ? actionCondition : [];
      let newConditions = conditions?.map(cond => {
        if (cond.id === condition.id) {
          return { ...cond, ...condition };
        }

        return cond;
      });
      let updatedActions = {
        ...actions,
        [actionId]: { ...action, condition: newConditions },
      };

      const isValid = isActionPayloadValid({
        action: updatedActions[actionId] as WorkflowAction,
        block: {} as RefinedIntegrationApi,
      });

      setActionsValidityObject(prev => ({ ...prev, [actionId]: isValid }));

      if (isNewCondition) {
        const newActionId = createId();
        newConditions = [...conditions, { ...condition, actionId: newActionId }];
        updatedActions = {
          ...actions,
          [actionId]: { ...action, condition: newConditions },
          [newActionId]: {
            id: newActionId,
            type: '',
            parentActionId: actionId,
          },
        };
      }

      setActions(updatedActions);

      if (isNewCondition && isPathFromGraph) {
        setNewActionCond({
          actionId,
          condId: condition.id!,
        });
      }

      const constuctedBlueprint = constructBluePrint({
        blueprintInfo,
        trigger,
        actions: updatedActions,
      });
      updateLocalBlueprint(constuctedBlueprint);
      return constuctedBlueprint;
    },
    [actions, blueprintInfo, trigger, updateLocalBlueprint],
  );

  useEffect(() => {
    if (newActionCond) {
      const action = actions[newActionCond.actionId];
      const condition = (action.condition as WorkflowLogicConditionGroup[])?.find(
        cond => cond.id === newActionCond.condId,
      );
      if (condition) {
        setSelectedBlock({ type: 'path', block: condition });
      }
      setNewActionCond(undefined);
    }
  }, [newActionCond, actions]);

  const constructedBlueprint = constructBluePrint({
    blueprintInfo,
    trigger,
    actions,
  });

  const contextValue: WorkflowContextProps = useMemo(() => {
    return {
      blueprintInfo,
      trigger,
      actions,
      blueprintId,
      frameworkApi,
      frameworkApis,
      frameworkEvent,
      frameworkEvents,
      updateTrigger: handleUpdateTrigger,
      updateAction: handleUpdateAction,
      updateBlueprintInfo: handleUpdateBlueprintInfo,
      constructedBlueprint,
      setActions: handleSetActions,
      selectedBlock,
      setSelectedBlock,
      setTrigger: handleSetTrigger,
      setBlueprintInfo,
      updateLogicActionCondition: handleUpdateLogicActionCondition,
      removeAction: handleRemoveAction,
      addNewBlankAction: handleNewBlankAction,
      isTriggerValid,
      actionsValidityObject,
      attemptedPublish,
      setAttempedPublish,
      currentLocalBlueprint,
      localBlueprints,
      updateLocalBlueprint,
    };
  }, [
    blueprintInfo,
    trigger,
    actions,
    blueprintId,
    frameworkApi,
    frameworkApis,
    frameworkEvent,
    frameworkEvents,
    handleUpdateTrigger,
    handleUpdateAction,
    constructedBlueprint,
    selectedBlock,
    handleSetTrigger,
    handleUpdateLogicActionCondition,
    handleRemoveAction,
    handleNewBlankAction,
    handleSetActions,
    isTriggerValid,
    actionsValidityObject,
    attemptedPublish,
    currentLocalBlueprint,
    localBlueprints,
    handleUpdateBlueprintInfo,
    updateLocalBlueprint,
  ]);

  return <WorkflowContext.Provider value={contextValue}>{children}</WorkflowContext.Provider>;
};
