import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { MemoryIcon } from '@mastra/playground-ui/icons/MemoryIcon';
import { Controller, useWatch } from 'react-hook-form';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { RegisteredMemoryNotice } from '../registered-memory-notice';
import { LastMessagesEntity } from './memory/last-messages-entity';
import { ObservationalMemoryEntity } from './memory/observational-memory-entity';
import { ReadOnlyEntity } from './memory/read-only-entity';
import { SemanticRecallEntity } from './memory/semantic-recall-entity';
import { SectionHeader } from '@/domains/cms';

export function MemoryPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const isEnabled = useWatch({ control, name: 'memory.enabled' }) ?? false;
  const memoryRef = useWatch({ control, name: 'memoryRef' });

  if (memoryRef) {
    return (
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4">
          <SectionHeader
            title="Memory"
            subtitle="Configure memory settings for conversation persistence and semantic recall."
          />
          <RegisteredMemoryNotice memoryId={memoryRef.memoryId} />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Memory"
            subtitle="Configure memory settings for conversation persistence and semantic recall."
          />
          {!readOnly && isEnabled && (
            <Controller
              name="memory.enabled"
              control={control}
              render={({ field }) => <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />}
            />
          )}
        </div>

        {!isEnabled && (
          <div className="py-8">
            <EmptyState
              titleSlot="Memory is not enabled"
              descriptionSlot="Enable memory to store conversation history, add semantic recall for relevant retrieval, or observational memory for long-term learning."
              actionSlot={
                !readOnly && (
                  <Controller
                    name="memory.enabled"
                    control={control}
                    render={({ field }) => (
                      <Button icon={<MemoryIcon />} variant="default" size="sm" onClick={() => field.onChange(true)}>
                        Enable Memory
                      </Button>
                    )}
                  />
                )
              }
            />
          </div>
        )}

        {isEnabled && (
          <div className="flex flex-col gap-2">
            <ObservationalMemoryEntity />
            <LastMessagesEntity />
            <SemanticRecallEntity />
            <ReadOnlyEntity />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
