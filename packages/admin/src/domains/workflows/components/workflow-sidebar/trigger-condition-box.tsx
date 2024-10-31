'use client';

import type { ConditionConj, WorkflowTrigger, UpdateTrigger } from '@mastra/core';
import { createId } from '@paralleldrive/cuid2';
import { useState } from 'react';

import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { ConditionConjDropdown } from './condition-conj-dropdown';
import { TriggerConditionFilterBar } from './trigger-condition-filter-bar';

interface TriggerConditionBoxProps {
  trigger: WorkflowTrigger;
  onUpdateTrigger: (updatedTrigger: UpdateTrigger) => void;
}

export function TriggerConditionBox({ trigger, onUpdateTrigger }: TriggerConditionBoxProps) {
  const { condition } = trigger;
  const { and, or } = condition || {};
  const extras = and || or;

  const defaultConj = and ? 'and' : 'or';
  const [conjState, setConjState] = useState<ConditionConj>(defaultConj || 'and');

  const handleAddConjCondition = () => {
    const updatedCondition = {
      ...(condition || {}),
      [conjState]: [...(extras || []), { field: '', operator: '', value: '', id: createId() }],
    };

    onUpdateTrigger({ condition: updatedCondition });
  };

  const handleUpdateConjCondition = (newConj: ConditionConj) => {
    if (condition) {
      let updatedCondition = condition;
      delete updatedCondition[conjState];
      updatedCondition = {
        ...condition,
        [newConj]: extras,
      };
      setConjState(newConj);

      onUpdateTrigger({ condition: updatedCondition });
    }
  };
  return (
    <div className="space-y-3">
      <Text size="xs" className="text-mastra-el-3">
        Condition
      </Text>
      {/*this renders the condition for the bar*/}
      <div className="gap-xs flex flex-col">
        <TriggerConditionFilterBar trigger={trigger} condition={condition || {}} onUpdateTrigger={onUpdateTrigger} />
        {extras?.map((extra, index) => (
          <div key={index} className="gap-xs flex items-center">
            {/*this renders the condition rule dropdown which can either be AND or OR*/}
            <ConditionConjDropdown conj={conjState} updateConj={handleUpdateConjCondition} />
            <div className="inline-block">
              <TriggerConditionFilterBar
                trigger={trigger}
                condition={extra}
                parentCondition={condition || {}}
                conj={conjState}
                onUpdateTrigger={onUpdateTrigger}
              />
            </div>
          </div>
        ))}
      </div>
      {condition ? (
        <IconButton
          icon="plus-icon"
          className="flex h-6 w-6 items-center justify-center rounded-r bg-[#2A2A2A] p-1.5"
          onClick={handleAddConjCondition}
          aria-label="Add new filter"
        />
      ) : null}
    </div>
  );
}
