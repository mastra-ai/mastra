import { jsonLanguage } from '@codemirror/lang-json';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import CodeMirror from '@uiw/react-codemirror';
import { Play } from 'lucide-react';
import { useState, useEffect } from 'react';
import type {
  ProcessorDetail,
  ProcessorPhase,
  MastraDBMessage,
  ExecuteProcessorResponse,
} from '../hooks/use-processors';
import { useProcessor, useExecuteProcessor } from '../hooks/use-processors';

export interface ProcessorPanelProps {
  processorId: string;
}

export interface ProcessorDetailPanelProps {
  processor: ProcessorDetail;
}

const PHASE_LABELS: Record<ProcessorPhase, string> = {
  input: 'Input - Process input messages before LLM (once at start)',
  inputStep: 'Input Step - Process at each agentic loop step',
  outputStream: 'Output Stream - Process streaming chunks',
  outputResult: 'Output Result - Process complete output after streaming',
  outputStep: 'Output Step - Process after each LLM response (before tools)',
  toolResult: 'Tool Result - Process tool output before it is added to the message list',
  llmRequest: 'LLM Request - Transform the provider prompt before each LLM call',
};

export function ProcessorPanel({ processorId }: ProcessorPanelProps) {
  const { data: processor, isLoading, error } = useProcessor(processorId);

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load processor';
      toast.error(`Error loading processor: ${errorMessage}`);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) return null;

  if (!processor)
    return (
      <div className="px-4 py-8 text-center">
        <Txt variant="heading" tone="muted">
          Processor not found
        </Txt>
      </div>
    );

  return <ProcessorDetailPanel processor={processor} />;
}

function ProcessorDetailPanel({ processor }: ProcessorDetailPanelProps) {
  const theme = useCodemirrorTheme();

  const [selectedPhase, setSelectedPhase] = useState<ProcessorPhase>(processor.phases[0] || 'input');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(processor.configurations[0]?.agentId || '');
  const [testMessage, setTestMessage] = useState('Hello, this is a test message.');
  const [result, setResult] = useState<ExecuteProcessorResponse | null>(null);
  const [errorString, setErrorString] = useState<string | undefined>();

  const executeProcessor = useExecuteProcessor();

  const handleExecute = async () => {
    setErrorString(undefined);
    setResult(null);

    // For output phases (outputStep, outputResult), use 'assistant' role since
    // processors receive assistant messages for those phases in real usage
    const isOutputPhase = selectedPhase === 'outputStep' || selectedPhase === 'outputResult';
    const messageRole = isOutputPhase ? 'assistant' : 'user';

    const messages: MastraDBMessage[] = [
      {
        id: crypto.randomUUID(),
        role: messageRole,
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: testMessage }],
        },
      },
    ];

    try {
      const response = await executeProcessor.mutateAsync({
        processorId: processor.id,
        phase: selectedPhase,
        messages,
        agentId: selectedAgentId || undefined,
      });
      setResult(response);

      if (!response.success && response.error) {
        setErrorString(response.error);
      }
    } catch (error: any) {
      setErrorString(error.message || 'An error occurred');
    }
  };

  const resultCode = result ? JSON.stringify(result, null, 2) : '{}';

  return (
    <div className="relative grid h-full min-w-min grid-cols-[auto_1fr] overflow-x-auto overflow-y-auto">
      <div className="w-[22rem] overflow-y-auto border-r border-border">
        <ProcessorInformation processor={processor} />

        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <Field>
              <FieldLabel>Phase</FieldLabel>
              <Select
                value={selectedPhase}
                onValueChange={value => {
                  const phase = processor.phases.find(phase => phase === value);
                  if (phase) setSelectedPhase(phase);
                }}
              >
                <SelectTrigger className="w-full">
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
              <FieldLabel>Agent Configuration</FieldLabel>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-full">
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
            <FieldLabel>Test Message</FieldLabel>
            <Textarea
              value={testMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTestMessage(e.target.value)}
              placeholder="Enter a test message..."
              rows={4}
            />
          </Field>

          <Button
            icon={<Play />}
            onClick={handleExecute}
            disabled={executeProcessor.isPending || selectedPhase === 'outputStream' || selectedPhase === 'llmRequest'}
            className="w-full"
          >
            {executeProcessor.isPending ? 'Running...' : 'Run Processor'}
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

          {result && (
            <div className="space-y-2 border-t border-border pt-4">
              <Txt variant="caption" tone="muted">
                Status
              </Txt>
              <div className="flex items-center gap-2">
                <Badge variant={result.success ? 'green' : 'red'}>{result.success ? 'Success' : 'Failed'}</Badge>
                {result.tripwire?.triggered && <Badge variant="blue">Tripwire Triggered</Badge>}
              </div>
              {result.tripwire?.triggered && result.tripwire.reason && (
                <div className="mt-2 rounded-md border border-warning-edge bg-warning-subtle p-3">
                  <Txt variant="column" className="text-warning-subtle-foreground">
                    Tripwire Reason
                  </Txt>
                  <Txt variant="caption" tone="muted" className="mt-1">
                    {result.tripwire.reason}
                  </Txt>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <CopyButton content={resultCode} tooltip="Copy JSON result to clipboard" />
      </div>

      <div className="relative h-full overflow-x-auto overflow-y-auto p-5">
        <CodeMirror value={errorString || resultCode} editable={true} theme={theme} extensions={[jsonLanguage]} />
      </div>
    </div>
  );
}

interface ProcessorInformationProps {
  processor: ProcessorDetail;
}

function ProcessorInformation({ processor }: ProcessorInformationProps) {
  return (
    <div className="border-b border-border px-5 pt-5 pb-4">
      <Txt variant="heading" tone="faint" className="mb-2">
        {processor.name || processor.id}
      </Txt>
      {processor.name && processor.name !== processor.id && (
        <Txt variant="caption" tone="muted" className="mb-3">
          {processor.id}
        </Txt>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        {processor.phases.map(phase => (
          <Badge key={phase}>{phase}</Badge>
        ))}
      </div>
      <div className="mt-3">
        <Txt variant="meta" tone="muted">
          Attached to {processor.configurations.length} agent{processor.configurations.length !== 1 ? 's' : ''}
        </Txt>
      </div>
    </div>
  );
}
