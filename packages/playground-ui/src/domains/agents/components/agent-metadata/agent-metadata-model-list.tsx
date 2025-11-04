import { GetAgentResponse, ReorderModelListParams, UpdateModelInModelListParams } from '@mastra/client-js';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { useState } from 'react';
import { AgentMetadataModelSwitcher } from './agent-metadata-model-switcher';
import { Icon } from '@/ds/icons';
import { GripVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type AgentMetadataModelListType = NonNullable<GetAgentResponse['modelList']>;

export interface AgentMetadataModelListProps {
  modelList: AgentMetadataModelListType;
  updateModelInModelList: AgentMetadataModelListItemProps['updateModelInModelList'];
  reorderModelList: (params: ReorderModelListParams) => void;
}

export const AgentMetadataModelList = ({
  modelList,
  updateModelInModelList,
  reorderModelList,
}: AgentMetadataModelListProps) => {
  const [modelConfigs, setModelConfigs] = useState(() => modelList);
  const hasMultipleModels = modelConfigs.length > 1;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(modelConfigs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setModelConfigs(items);
    reorderModelList({ reorderedModelIds: items.map(item => item.id) });
  };

  const updateModel = (params: UpdateModelInModelListParams) => {
    setModelConfigs(prev =>
      prev.map(modelConfig =>
        modelConfig.id === params.modelConfigId
          ? {
              ...modelConfig,
              enabled: params.enabled ?? modelConfig.enabled,
              maxRetries: params.maxRetries ?? modelConfig.maxRetries,
              model: {
                modelId: params.model?.modelId ?? modelConfig.model.modelId,
                provider: params.model?.provider ?? modelConfig.model.provider,
                modelVersion: modelConfig.model.modelVersion,
              },
            }
          : modelConfig,
      ),
    );
    return updateModelInModelList(params);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="model-list">
        {provided => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col gap-2">
            {modelConfigs.map((modelConfig, index) => (
              <Draggable key={modelConfig.id} draggableId={modelConfig.id} index={index}>
                {provided => (
                  <div ref={provided.innerRef} {...provided.draggableProps} style={provided.draggableProps.style}>
                    <AgentMetadataModelListItem
                      modelConfig={modelConfig}
                      updateModelInModelList={updateModel}
                      showDragHandle={hasMultipleModels}
                      dragHandleProps={provided.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

interface AgentMetadataModelListItemProps {
  modelConfig: AgentMetadataModelListType[number];
  updateModelInModelList: (params: UpdateModelInModelListParams) => Promise<{ message: string }>;
  showDragHandle: boolean;
  dragHandleProps?: any;
}

const AgentMetadataModelListItem = ({
  modelConfig,
  updateModelInModelList,
  showDragHandle,
  dragHandleProps,
}: AgentMetadataModelListItemProps) => {
  const [enabled, setEnabled] = useState(() => modelConfig.enabled);

  return (
    <div className="rounded-lg bg-background hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 p-2">
        {showDragHandle && (
          <div {...dragHandleProps} className="text-icon3 cursor-grab active:cursor-grabbing flex-shrink-0">
            <Icon>
              <GripVertical />
            </Icon>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <AgentMetadataModelSwitcher
            defaultProvider={modelConfig.model.provider}
            defaultModel={modelConfig.model.modelId}
            updateModel={params => updateModelInModelList({ modelConfigId: modelConfig.id, model: params })}
            autoSave={true}
          />
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={checked => {
            setEnabled(checked);
            updateModelInModelList({ modelConfigId: modelConfig.id, enabled: checked });
          }}
          className="flex-shrink-0"
        />
      </div>
    </div>
  );
};
