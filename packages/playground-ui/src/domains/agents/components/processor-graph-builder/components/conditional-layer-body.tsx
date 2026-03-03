import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Plus, Ruler } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { IconButton } from '@/ds/components/IconButton';
import type { ProcessorGraphEntryDepth2 } from '@mastra/core/storage';
import { useProcessorGraphBuilderContext } from './processor-graph-builder-context';
import { ConditionRulesDialog } from './condition-rules-dialog';
import type { BuilderLayer, RuleGroup } from '../types';
import { ProcessorStepCard } from './processor-step-card';
import { EmptySlot } from './empty-slot';

interface ConditionEntry {
  steps: ProcessorGraphEntryDepth2[];
  rules?: RuleGroup;
}

function countRules(rules?: RuleGroup): number {
  return rules?.conditions?.length ?? 0;
}

interface ConditionalLayerBodyProps {
  layer: BuilderLayer;
}

export function ConditionalLayerBody({ layer }: ConditionalLayerBodyProps) {
  const { builder, readOnly, variablesSchema } = useProcessorGraphBuilderContext();
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);

  if (layer.entry.type !== 'conditional') return null;

  const { conditions } = layer.entry;
  const editingCondition = editingConditionIndex !== null ? conditions[editingConditionIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      {conditions.map((condition: ConditionEntry, condIndex: number) => {
        const ruleCount = countRules(condition.rules);

        return (
          <div key={condIndex} className="rounded border border-border1 bg-surface1 p-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={ruleCount > 0 ? 'info' : 'default'}>
                {ruleCount > 0 ? `${ruleCount} rule${ruleCount === 1 ? '' : 's'}` : 'Default'}
              </Badge>

              {!readOnly && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  tooltip="Edit rules"
                  onClick={() => setEditingConditionIndex(condIndex)}
                >
                  <Ruler className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </div>

            <Droppable droppableId={`layer-${layer.id}-cond-${condIndex}`} type="PROVIDER">
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1 min-h-[60px]">
                  {condition.steps.map((entry, stepIndex) => {
                    if (entry.type !== 'step') return null;
                    return (
                      <ProcessorStepCard
                        key={`${layer.id}-cond-${condIndex}-step-${stepIndex}`}
                        layerId={layer.id}
                        step={entry.step}
                        conditionIndex={condIndex}
                        stepIndex={stepIndex}
                      />
                    );
                  })}
                  {condition.steps.length === 0 && <EmptySlot isDraggingOver={snapshot.isDraggingOver} />}
                  <div className="hidden">{provided.placeholder}</div>
                </div>
              )}
            </Droppable>
          </div>
        );
      })}

      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => builder.addCondition(layer.id)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add condition
        </Button>
      )}

      {variablesSchema && (
        <ConditionRulesDialog
          isOpen={editingConditionIndex !== null}
          onClose={() => setEditingConditionIndex(null)}
          rules={editingCondition?.rules}
          onSave={rules => {
            if (editingConditionIndex !== null) {
              builder.updateConditionRules(layer.id, editingConditionIndex, rules);
            }
          }}
          schema={variablesSchema}
        />
      )}
    </div>
  );
}
