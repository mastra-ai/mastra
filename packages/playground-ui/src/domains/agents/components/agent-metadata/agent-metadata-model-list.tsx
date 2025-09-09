import { GetAgentResponse, ReorderModelListParams, UpdateModelInModelListParams } from '@mastra/client-js';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { useState } from 'react';
import { providerMapToIcon } from '../provider-map-icon';
import { AgentMetadataModelSwitcher } from './agent-metadata-model-switcher';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { EditIcon, GripVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type AgentMetadataModelListType = NonNullable<GetAgentResponse['modelList']>;

export interface AgentMetadataModelListProps {
  modelList: AgentMetadataModelListType;
  modelProviders: string[];
  updateModelInModelList: AgentMetadataModelListItemProps['updateModelInModelList'];
  reorderModelList: (params: ReorderModelListParams) => void;
}

export const AgentMetadataModelList = ({
  modelList,
  modelProviders,
  updateModelInModelList,
  reorderModelList,
}: AgentMetadataModelListProps) => {
  const [modelConfigs, setModelConfigs] = useState(() => modelList);

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

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="model-list">
        {provided => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col gap-2">
            {modelConfigs.map((modelConfig, index) => (
              <Draggable key={modelConfig.id} draggableId={modelConfig.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={provided.draggableProps.style}
                  >
                    <AgentMetadataModelListItem
                      modelConfig={modelConfig}
                      modelProviders={modelProviders}
                      updateModelInModelList={updateModelInModelList}
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
  modelProviders: string[];
  updateModelInModelList: (params: UpdateModelInModelListParams) => Promise<{ message: string }>;
}

const AgentMetadataModelListItem = ({
  modelConfig,
  modelProviders,
  updateModelInModelList,
}: AgentMetadataModelListItemProps) => {
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [enabled, setEnabled] = useState(() => modelConfig.enabled);

  const providerIcon =
    providerMapToIcon[(modelConfig.model.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  return isEditingModel ? (
    <AgentMetadataModelSwitcher
      defaultProvider={modelConfig.model.provider}
      defaultModel={modelConfig.model.modelId}
      updateModel={params => updateModelInModelList({ modelConfigId: modelConfig.id, model: params })}
      closeEditor={() => setIsEditingModel(false)}
      modelProviders={modelProviders}
    />
  ) : (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-muted/50 transition-colors">
      <div className="text-icon3 cursor-grab active:cursor-grabbing">
        <Icon>
          <GripVertical />
        </Icon>
      </div>
      <Badge icon={providerIcon} className="font-medium">
        {modelConfig.model.modelId || 'N/A'}
      </Badge>
      <Switch
        checked={enabled}
        onCheckedChange={checked => {
          setEnabled(checked);
          updateModelInModelList({ modelConfigId: modelConfig.id, enabled: checked });
        }}
      />
      <button
        onClick={() => setIsEditingModel(true)}
        className="text-icon3 hover:text-icon6"
        title="Edit model"
        aria-label="Edit model"
      >
        <Icon>
          <EditIcon />
        </Icon>
      </button>
    </div>
  );
};
