import { Badge } from '@mastra/playground-ui/components/Badge';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { AgentChatSlots } from '@mastra/playground-ui/domains/agent-chat/context/agent-chat-slots';
import { AgentMetadataModelList } from '@mastra/playground-ui/domains/agent-chat/overview/metadata/agent-metadata-model-list';
import type { ComponentProps } from 'react';
import { useWatch } from 'react-hook-form';

import { AgentChannels } from './agent-channels/agent-channels';
import type { AgentEditFormContextValue } from '@/domains/agents/context/agent-edit-form-context';
import { useOptionalAgentEditFormContext } from '@/domains/agents/context/agent-edit-form-context';
import { getEditorOwnership } from '@/domains/agents/utils/editor-ownership';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';

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

/** Routes model edits through the editor form when the editor owns the model. */
const OverviewModelList: NonNullable<AgentChatSlots['OverviewModelList']> = ({ modelList, editable, fallback }) => {
  const editFormContext = useOptionalAgentEditFormContext();
  const { ownsModel } = getEditorOwnership(
    editFormContext?.isCodeAgentOverride ?? false,
    editFormContext?.editorConfig,
  );
  if (!ownsModel || !editFormContext) return fallback;
  return (
    <EditorOwnedModelList
      modelList={modelList}
      editable={editable}
      readOnly={editFormContext.readOnly}
      form={editFormContext.form}
    />
  );
};

const OverviewModelsActions = () => {
  const editFormContext = useOptionalAgentEditFormContext();
  return editFormContext?.readOnly ? <Badge variant="warning">Read-only</Badge> : null;
};

const SystemPromptNotice = () => {
  const { isCmsAvailable, isLoading } = useIsCmsAvailable();
  if (isLoading || isCmsAvailable) return null;
  return (
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
  );
};

export const studioOverviewSlots = {
  OverviewModelList,
  OverviewModelsActions,
  OverviewChannels: AgentChannels,
  SystemPromptNotice,
} satisfies Partial<AgentChatSlots>;
