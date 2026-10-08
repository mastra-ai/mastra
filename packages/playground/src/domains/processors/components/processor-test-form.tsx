import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ProcessorDetail, ProcessorPhase, MastraDBMessage } from '@mastra/react/hooks/processors';
import { useExecuteProcessor } from '@mastra/react/hooks/processors';
import { Play } from 'lucide-react';
import { useId, useState } from 'react';
import type { ProcessorExecutionState } from '../types/processor-execution-state';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

const PHASE_LABELS: Record<ProcessorPhase, string> = {
  input: 'Input - Process input messages before LLM (once at start)',
  inputStep: 'Input Step - Process at each agentic loop step',
  outputStream: 'Output Stream - Process streaming chunks',
  outputResult: 'Output Result - Process complete output after streaming',
  outputStep: 'Output Step - Process after each LLM response (before tools)',
  toolResult: 'Tool Result - Process tool output before it is added to the message list',
  llmRequest: 'LLM Request - Transform the provider prompt before each LLM call',
};

export function ProcessorTestForm({
  processor,
  onResult,
}: {
  processor: ProcessorDetail;
  onResult: (state: ProcessorExecutionState) => void;
}) {
  const phaseId = useId();
  const agentId = useId();
  const messageId = useId();
  const [selectedPhase, setSelectedPhase] = useState<ProcessorPhase>(processor.phases[0] || 'input');
  const [selectedAgentId, setSelectedAgentId] = useState(processor.configurations[0]?.agentId || '');
  const [testMessage, setTestMessage] = useState('Hello, this is a test message.');
  const { canExecute, isLoading } = usePermissions();
  const canRun = !isLoading && canExecute('processors');
  const executeProcessor = useExecuteProcessor();

  const handleExecute = async () => {
    if (!canRun || executeProcessor.isPending || selectedPhase === 'outputStream' || selectedPhase === 'llmRequest')
      return;
    onResult({ status: 'running' });
    const isOutputPhase = selectedPhase === 'outputStep' || selectedPhase === 'outputResult';
    const messages: MastraDBMessage[] = [
      {
        id: crypto.randomUUID(),
        role: isOutputPhase ? 'assistant' : 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: testMessage }] },
      },
    ];
    try {
      const response = await executeProcessor.mutateAsync({
        processorId: processor.id,
        phase: selectedPhase,
        messages,
        agentId: selectedAgentId || undefined,
      });
      onResult({ status: 'complete', response });
    } catch (error) {
      onResult({ status: 'error', message: error instanceof Error ? error.message : 'An error occurred' });
    }
  };

  return (
    <div className="space-y-5 p-3">
      <Txt as="h2" variant="subheading">
        Test processor
      </Txt>
      {processor.description && (
        <Txt variant="caption" tone="muted">
          {processor.description}
        </Txt>
      )}
      {processor.configurations.length === 1 && (
        <Txt variant="meta" tone="muted">
          Used by {processor.configurations[0].agentName}
        </Txt>
      )}
      <div className="space-y-2">
        <Field>
          <FieldLabel htmlFor={phaseId}>Phase</FieldLabel>
          <Select
            value={selectedPhase}
            onValueChange={value => {
              const phase = processor.phases.find(phase => phase === value);
              if (phase) setSelectedPhase(phase);
            }}
          >
            <SelectTrigger id={phaseId} className="w-full">
              <SelectValue placeholder="Select phase" />
            </SelectTrigger>
            <SelectContent>
              {processor.phases.map(phase => (
                <SelectItem key={phase} value={phase}>
                  {phase}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Txt variant="meta" tone="muted">
          {PHASE_LABELS[selectedPhase]}
        </Txt>
      </div>

      {processor.configurations.length > 1 && (
        <Field>
          <FieldLabel htmlFor={agentId}>Agent configuration</FieldLabel>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger id={agentId} className="w-full">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {processor.configurations.map(config => (
                <SelectItem key={config.agentId} value={config.agentId}>
                  {config.agentName} ({config.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor={messageId}>Test message</FieldLabel>
        <Textarea
          id={messageId}
          value={testMessage}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTestMessage(e.target.value)}
          placeholder="Enter a test message..."
          rows={4}
        />
      </Field>

      <Button
        icon={<Play />}
        onClick={handleExecute}
        disabled={
          !canRun || executeProcessor.isPending || selectedPhase === 'outputStream' || selectedPhase === 'llmRequest'
        }
        className="w-full"
      >
        {executeProcessor.isPending ? 'Running...' : 'Run processor'}
      </Button>

      {selectedPhase === 'outputStream' && (
        <Txt variant="meta" className="text-warning-foreground">
          Output Stream phase cannot be executed directly. Use streaming instead.
        </Txt>
      )}

      {selectedPhase === 'llmRequest' && (
        <Txt variant="meta" className="text-warning-foreground">
          LLM Request phase cannot be executed directly. It runs on the provider prompt during an agent call.
        </Txt>
      )}

      {!isLoading && !canRun && (
        <Txt variant="meta" tone="muted">
          You don't have permission to execute processors.
        </Txt>
      )}
    </div>
  );
}
