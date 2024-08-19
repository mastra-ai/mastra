import type { WorkflowAction, Blueprint } from 'core';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import SelectDropDown from '@/components/ui/select-dropdown';
import { Text } from '@/components/ui/text';

import { isObjectEmpty } from '@/lib/object';
import { toast } from '@/lib/toast';

import { Icon } from '@/app/components/icon';

import { useWorkflowContext } from '../../context/workflow-context';

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
    trigger,
    setSelectedBlock,
    setAttempedPublish,
  } = useWorkflowContext();
  const [open, setOpen] = useState(false);

  const isPublished = constructedBlueprint.status === 'PUBLISHED';

  const existingInvalidActions = Object.entries(actionsValidityObject).filter(
    ([key, value]) => actions[key] && !value.isValid,
  );
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

  async function toggleWorkflowStatus() {
    const configurationDone = isTriggerValid && allActionsValid && allActionsHaveType;
    setAttempedPublish(true);
    if ((!configurationDone || isObjectEmpty(actions)) && !isPublished) {
      toast('Please finish your workflow configuration before publishing it');
      if (!isTriggerValid) {
        setSelectedBlock({ type: 'trigger', block: trigger });
      } else if (!allActionsValid) {
        const first = existingInvalidActions[0][0];
        setSelectedBlock({ type: 'action', block: actions[first] as WorkflowAction });
      } else if (!allActionsHaveType) {
        const first = existingActionsWithoutType[0][0];
        setSelectedBlock({ type: 'action', block: actions[first] as WorkflowAction });
      }
      return;
    }
    const updatedBlueprint: Blueprint = {
      ...constructedBlueprint,
      status: isPublished ? 'DRAFT' : 'PUBLISHED',
    };

    updateBlueprintInfo({ ...blueprintInfo, status: updatedBlueprint.status });

    // write workflow to json file
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
            setOpen(false);
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
          {isPublished ? `Workflow is published` : `Workflow has not been published`}
        </Text>
        <Button
          variant="ghost"
          className="border-[#7575754D] bg-[#353535] rounded-[0.1875rem] border-[0.5px] border-solid px-[0.69rem] py-[0.34rem] text-xs opacity-80 transition-opacity hover:opacity-100"
          onClick={() => toggleWorkflowStatus()}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
