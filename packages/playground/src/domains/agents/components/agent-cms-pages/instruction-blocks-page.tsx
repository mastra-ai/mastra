import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Controller } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { getEditorOwnership } from '../../utils/editor-ownership';
import { AgentCMSBlocks } from '../agent-cms-blocks';

export function InstructionBlocksPage() {
  const { form, readOnly, isCodeAgentOverride, editorConfig } = useAgentEditFormContext();
  const { isInstructionsLocked } = getEditorOwnership(isCodeAgentOverride, editorConfig);
  const isReadOnly = readOnly || isInstructionsLocked;

  const schema = form.watch('variables');

  return (
    <ScrollArea className="h-full">
      {isInstructionsLocked && (
        <Notice variant="info" title="Instructions are owned by code">
          <Notice.Message>
            This code-defined agent has disabled instructions editing from Studio. Update the agent definition in code
            to change its instructions.
          </Notice.Message>
        </Notice>
      )}
      <Controller
        name="instructionBlocks"
        control={form.control}
        defaultValue={[]}
        render={({ field }) => (
          <AgentCMSBlocks
            items={field.value ?? []}
            onChange={field.onChange}
            placeholder="Enter content..."
            schema={schema}
            readOnly={isReadOnly}
          />
        )}
      />
    </ScrollArea>
  );
}
