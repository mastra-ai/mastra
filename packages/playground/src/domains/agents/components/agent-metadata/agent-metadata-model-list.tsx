import type { DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { GetAgentResponse, ReorderModelListParams, UpdateModelInModelListParams } from '@mastra/client-js';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { GripVertical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AgentMetadataModelSwitcher } from './agent-metadata-model-switcher';

type AgentMetadataModelListType = NonNullable<GetAgentResponse['modelList']>;

export interface AgentMetadataModelListProps {
  modelList: AgentMetadataModelListType;
  updateModelInModelList: AgentMetadataModelListItemProps['updateModelInModelList'];
  reorderModelList: (params: ReorderModelListParams) => Promise<{ message: string }>;
  /** False when the list comes from a function in code; renders it without edit controls */
  editable?: boolean;
}

export const AgentMetadataModelList = ({
  modelList,
  updateModelInModelList,
  reorderModelList,
  editable = true,
}: AgentMetadataModelListProps) => {
  const [modelConfigs, setModelConfigs] = useState(() => modelList);
  const hasMultipleModels = modelConfigs.length > 1;
  const enabledCount = modelConfigs.filter(m => m.enabled !== false).length;

  useEffect(() => {
    setModelConfigs(modelList);
  }, [modelList]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(modelConfigs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setModelConfigs(items);
    try {
      await reorderModelList({ reorderedModelIds: items.map(item => item.id) });
    } catch {
      setModelConfigs(modelConfigs);
    }
  };

  const updateModel = async (params: UpdateModelInModelListParams) => {
    const previousModelConfigs = modelConfigs;
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
    try {
      return await updateModelInModelList(params);
    } catch (error) {
      setModelConfigs(previousModelConfigs);
      throw error;
    }
  };

  if (!editable) {
    return <AgentMetadataReadOnlyModelList modelList={modelList} />;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="model-list">
        {(provided: DroppableProvided) => (
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
                      isLastEnabled={modelConfig.enabled !== false && enabledCount === 1}
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

const AgentMetadataReadOnlyModelList = ({ modelList }: { modelList: AgentMetadataModelListType }) => (
  <div className="flex flex-col gap-2">
    <Txt variant="caption" tone="muted">
      This model list is dynamically set and cannot be edited in Studio.
    </Txt>
    {modelList.map(modelConfig => (
      <div key={modelConfig.id} className="flex items-center gap-2 rounded-lg bg-sidebar p-2">
        <Txt as="span" variant="caption" tone="ink" className="min-w-0 flex-1 truncate">
          {modelConfig.model.provider}/{modelConfig.model.modelId}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="shrink-0">
          {modelConfig.enabled === false ? 'Disabled' : 'Enabled'}
        </Txt>
      </div>
    ))}
  </div>
);

interface AgentMetadataModelListItemProps {
  modelConfig: AgentMetadataModelListType[number];
  updateModelInModelList: (params: UpdateModelInModelListParams) => Promise<{ message: string }>;
  showDragHandle: boolean;
  dragHandleProps?: any;
  isLastEnabled: boolean;
}

const AgentMetadataModelListItem = ({
  modelConfig,
  updateModelInModelList,
  showDragHandle,
  dragHandleProps,
  isLastEnabled,
}: AgentMetadataModelListItemProps) => {
  return (
    <div className="state-layer rounded-lg bg-sidebar">
      <div className="flex items-center gap-2 p-2">
        {showDragHandle && (
          <div {...dragHandleProps} className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing">
            <Icon>
              <GripVertical />
            </Icon>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <AgentMetadataModelSwitcher
            defaultProvider={modelConfig.model.provider}
            defaultModel={modelConfig.model.modelId}
            updateModel={params => updateModelInModelList({ modelConfigId: modelConfig.id, model: params })}
            autoSave={true}
          />
        </div>
        {isLastEnabled ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0">
                  <Switch checked={modelConfig.enabled} disabled className="pointer-events-none" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>At least one model must be enabled</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Switch
            checked={modelConfig.enabled}
            onCheckedChange={checked => {
              void updateModelInModelList({ modelConfigId: modelConfig.id, enabled: checked }).catch(() => undefined);
            }}
            className="shrink-0"
          />
        )}
      </div>
    </div>
  );
};
