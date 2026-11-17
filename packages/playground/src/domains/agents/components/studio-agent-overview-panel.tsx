import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { AgentMetadataModelList } from '@mastra/playground-ui/domains/agents/components/agent-metadata/agent-metadata-model-list';
import { AgentOverviewPanel } from '@mastra/playground-ui/domains/agents/components/agent-overview-panel/agent-overview-panel';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useAgent } from '@mastra/react/hooks/agents';
import type { ComponentProps } from 'react';
import { useWatch } from 'react-hook-form';
import { AgentChannels } from './agent-channels/agent-channels';
import type { AgentEditFormContextValue } from '@/domains/agents/context/agent-edit-form-context';
import { useOptionalAgentEditFormContext } from '@/domains/agents/context/agent-edit-form-context';
import { getEditorOwnership } from '@/domains/agents/utils/editor-ownership';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useRouteSidePanel } from '@/lib/route-side-panel';

type ModelListProps = ComponentProps<typeof AgentMetadataModelList>;

function EditorOwnedModelList({
  modelList,
  editable,
  readOnly,
  form,
}: Pick<ModelListProps, 'modelList' | 'editable' | 'readOnly'> & Pick<AgentEditFormContextValue, 'form'>) {
  const formModelList = useWatch({ control: form.control, name: 'modelList' });

  const reorderModelList: NonNullable<ModelListProps['reorderModelList']> = async params => {
    const currentList = form.getValues('modelList') ?? [];
    const entriesById = new Map(currentList.map(entry => [entry.id, entry]));
    form.setValue(
      'modelList',
      params.reorderedModelIds.flatMap(id => {
        const entry = entriesById.get(id);
        return entry ? [entry] : [];
      }),
      { shouldDirty: true },
    );
    return { message: 'Model list reordered' };
  };

  const updateModelInModelList: NonNullable<ModelListProps['updateModelInModelList']> = async params => {
    const currentList = form.getValues('modelList') ?? [];
    form.setValue(
      'modelList',
      currentList.map(entry =>
        entry.id === params.modelConfigId
          ? {
              ...entry,
              enabled: params.enabled ?? entry.enabled,
              maxRetries: params.maxRetries ?? entry.maxRetries,
              model: {
                ...entry.model,
                provider: params.model?.provider ?? entry.model.provider,
                modelId: params.model?.modelId ?? entry.model.modelId,
              },
            }
          : entry,
      ),
      { shouldDirty: true },
    );
    return { message: 'Model updated' };
  };

  return (
    <AgentMetadataModelList
      modelList={formModelList ?? modelList}
      editable={editable}
      readOnly={readOnly}
      updateModelInModelList={updateModelInModelList}
      reorderModelList={reorderModelList}
    />
  );
}

/** Studio's Config panel: the shared overview panel plus the editor, CMS and channel pieces only Studio has. */
export function StudioAgentOverviewPanel({ agentId }: { agentId: string }) {
  const { isCollapsed } = useRouteSidePanel();
  const editFormContext = useOptionalAgentEditFormContext();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: agent } = useAgent({
    agentId,
    version: { status: 'draft' },
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const ownsModel = getEditorOwnership(
    editFormContext?.isCodeAgentOverride ?? false,
    editFormContext?.editorConfig,
  ).ownsModel;

  const modelListSlot =
    ownsModel && editFormContext && agent?.modelList ? (
      <EditorOwnedModelList
        modelList={agent.modelList}
        editable={agent.modelListEditable !== false}
        readOnly={editFormContext.readOnly}
        form={editFormContext.form}
      />
    ) : undefined;

  return (
    <AgentOverviewPanel
      agentId={agentId}
      isCollapsed={isCollapsed}
      modelListSlot={modelListSlot}
      modelListReadOnly={editFormContext?.readOnly}
      channelsSlot={<AgentChannels agentId={agentId} />}
      systemPromptNoticeSlot={
        !isCmsLoading && !isCmsAvailable ? (
          <Notice variant="warning" title="Read-only">
            <Notice.Message>
              To edit the system prompt in Studio, add <InlineCode>@mastra/editor</InlineCode> to your project. See the{' '}
              <a
                href="https://mastra.ai/docs/editor/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                documentation
              </a>
              .
            </Notice.Message>
          </Notice>
        ) : undefined
      }
    />
  );
}
