'use client';

import type { Blueprint } from '@mastra/core/dist/workflows/types';
import { useState } from 'react';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import SelectDropDown from '@/components/ui/select-dropdown';
import Spinner from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';

import { isObjectEmpty } from '@/lib/object';

import { useWorkflowContext } from '../../context/workflow-context';
import { useGetWorkflow, useUpdateWorkflow } from '../../hooks/use-workflow';
import { WorkflowStatusEnum } from '../../types';
import { constructWorkflowContextBluePrint } from '../../utils';

interface WorkflowPopupActionsBarProps {
  setScale: (scale: number) => void;
  scale: number;
}

const SCALE_OPTIONS = [
  {
    name: '25%',
    id: 0.25,
  },
  {
    name: '50%',
    id: 0.5,
  },
  {
    name: '75%',
    id: 0.75,
  },
  {
    name: '100%',
    id: 1,
  },
];

export const WorkflowPopupActionsBar = ({ scale, setScale }: WorkflowPopupActionsBarProps) => {
  const selected = SCALE_OPTIONS?.find(item => item.id === scale);
  const [selectedScale, setSelectedScale] = useState(selected ? [selected] : []);
  const {
    constructedBlueprint,
    blueprintInfo,
    blueprintId,
    updateBlueprintInfo,
    actionsValidityObject,
    isTriggerValid,
    actions,
    setTrigger,
    setActions,
    setBlueprintInfo,
    updateLocalBlueprint,
    currentLocalBlueprint,
  } = useWorkflowContext();
  const [open, setOpen] = useState(false);

  const { workflow, refetch } = useGetWorkflow({ blueprintId });

  const { updateBlueprint, isLoading } = useUpdateWorkflow({ blueprintId });

  const isWorkflowUpdated = currentLocalBlueprint?.status === WorkflowStatusEnum.DRAFT;

  const existingActionsWithoutType = Object.entries(actions).filter(([key, value]) => !value.type);

  const allActionsValid = Object.entries(actionsValidityObject).every(([key, value]) =>
    actions[key] ? value.isValid : true,
  );

  const allActionsHaveType = existingActionsWithoutType?.length === 0;

  const handleZoom = () => {
    const newScale = scale + 0.25;
    if (newScale <= 1) {
      const newSelected = SCALE_OPTIONS?.find(item => item.id === newScale);
      setScale(newScale);
      if (newSelected) {
        setSelectedScale([newSelected]);
      }
    }
  };

  const resetWorkflow = () => {
    const { blueprintInfo, trigger, actions } = constructWorkflowContextBluePrint(workflow);

    setBlueprintInfo(blueprintInfo);
    setTrigger(trigger || { id: '', type: '' });
    setActions(actions);
    updateLocalBlueprint(workflow, true);
  };

  async function saveWorkflow() {
    const configurationDone = isTriggerValid && allActionsValid && allActionsHaveType && !isObjectEmpty(actions);
    const _status =
      constructedBlueprint.status === WorkflowStatusEnum.DRAFT
        ? WorkflowStatusEnum.UNPUBLISHED
        : constructedBlueprint.status;
    const newStatus = constructedBlueprint.updatedAt ? _status : WorkflowStatusEnum.UNPUBLISHED;
    const updatedBlueprint: Blueprint = {
      ...constructedBlueprint,
      updatedAt: new Date(),
      status: !configurationDone ? WorkflowStatusEnum.UNPUBLISHED : newStatus,
    };

    updateBlueprintInfo({ ...blueprintInfo, status: updatedBlueprint.status, updatedAt: updatedBlueprint.updatedAt });
    await updateBlueprint(updatedBlueprint);
    refetch();
  }

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 flex w-full -translate-x-1/2 justify-center gap-2">
      <div className="shadow-main pointer-events-auto flex items-center gap-x-2 rounded-lg bg-[#282828]/30 p-2 backdrop-blur">
        <SelectDropDown
          isSingleSelect
          withSearch={false}
          asRadio
          withCheckbox={false}
          selectedValues={selectedScale}
          setSelectedValues={setSelectedScale}
          onSelectItem={val => {
            setScale(val.id);
          }}
          data={SCALE_OPTIONS}
          placeholder="Select zoom"
          open={open}
          onOpenChange={setOpen}
        >
          <Button className="rounded border-[0.5px] border-solid border-[#7575754D] bg-[#353535] text-[10px] text-[#A9A9A9]">
            <Icon name="search" />
            {scale * 100 || '100'}%
            <Icon name="chevron-down" />
          </Button>
        </SelectDropDown>
        <IconButton
          asSprite
          icon="zoom-in"
          className="rounded border-[0.5px] border-solid border-[#7575754D] bg-[#353535] px-2"
          iconClassname="text-[#A9A9A9]"
          onClick={handleZoom}
        />
      </div>
      <div className="shadow-main pointer-events-auto flex items-center gap-x-[0.88rem] rounded-lg bg-[#282828]/30 p-2 backdrop-blur">
        <Text size="xs" className="pl-2">
          {isLoading ? 'Workflow saving...' : isWorkflowUpdated ? 'Workflow has not been saved' : 'Workflow saved'}
        </Text>
        {isWorkflowUpdated ? (
          <Button
            variant="ghost"
            className="border-[#7575754D] bg-[#353535] rounded-[0.1875rem] border-[0.5px] border-solid px-[0.69rem] py-[0.34rem] text-xs opacity-80 transition-opacity hover:opacity-100"
            onClick={() => resetWorkflow()}
          >
            Reset
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="bg-mastra-bg-7 border-mastra-border-4 rounded-[0.1875rem] border-[0.5px] border-solid px-[0.69rem] py-[0.34rem] text-xs opacity-80 transition-opacity hover:opacity-100"
          onClick={() => saveWorkflow()}
          disabled={!isWorkflowUpdated}
        >
          Save
          {isLoading && <Spinner className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
