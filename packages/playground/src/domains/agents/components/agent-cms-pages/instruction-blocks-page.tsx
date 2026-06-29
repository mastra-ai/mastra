import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Controller } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentCMSBlocks } from '../agent-cms-blocks/agent-cms-blocks';

export function InstructionBlocksPage({ layout = 'page' }: { layout?: 'page' | 'panel' }) {
  const { form, readOnly, isCodeAgentOverride, editorConfig } = useAgentEditFormContext();

  const schema = form.watch('variables');
  const compact = layout === 'panel';
  const instructionsReadOnly =
    readOnly ||
    (isCodeAgentOverride &&
      editorConfig !== undefined &&
      (editorConfig === false || editorConfig?.instructions !== true));

  const content = (
    <div className={cn('h-full min-h-0', compact ? 'p-3' : 'px-2 py-6')}>
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
            readOnly={instructionsReadOnly}
            compact={compact}
          />
        )}
      />
    </div>
  );

  if (compact) return content;

  return <ScrollArea className="h-full">{content}</ScrollArea>;
}
