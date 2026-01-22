import { useState, useId, useEffect } from 'react';
import { CopyButton } from '@/ds/components/CopyButton';
import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import CodeMirror from '@uiw/react-codemirror';
import { MainContentContent } from '@/ds/components/MainContent';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';
import { Skeleton } from '@/ds/components/Skeleton';
import { toast } from '@/lib/toast';
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
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) return null;

  if (!processor)
    return (
      <div className="py-12 text-center px-6">
        <Txt variant="header-md" className="text-neutral3">
          Processor not found
        </Txt>
      </div>
    );

  return <ProcessorDetailPanel processor={processor} />;
}

function ProcessorDetailPanel({ processor }: ProcessorDetailPanelProps) {
  const theme = useCodemirrorTheme();
  const formId = useId();

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
    <MainContentContent hasLeftServiceColumn={true} className="relative">
      <div className="bg-surface2 border-r border-border1 w-[22rem] overflow-y-auto">
        <ProcessorInformation processor={processor} />

        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <Txt as="label" variant="ui-sm" className="text-icon3">
              Phase
            </Txt>
            <Select value={selectedPhase} onValueChange={v => setSelectedPhase(v as ProcessorPhase)}>
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
            <Txt variant="ui-xs" className="text-icon4">
              {PHASE_LABELS[selectedPhase]}
            </Txt>
          </div>

          {processor.configurations.length > 1 && (
            <div className="space-y-2">
              <Txt as="label" variant="ui-sm" className="text-icon3">
                Agent Configuration
              </Txt>
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
            </div>
          )}

          <div className="space-y-2">
            <Txt as="label" htmlFor={formId} variant="ui-sm" className="text-icon3">
              Test Message
            </Txt>
            <textarea
              id={formId}
              value={testMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTestMessage(e.target.value)}
              placeholder="Enter a test message..."
              rows={4}
              className="w-full bg-transparent border border-border1 rounded-md p-3 text-ui-sm text-neutral6 placeholder:text-neutral3 focus:outline-none focus:ring-2 focus:ring-accent1"
            />
          </div>

          <Button
            onClick={handleExecute}
            disabled={executeProcessor.isPending || selectedPhase === 'outputStream'}
            className="w-full"
          >
            {executeProcessor.isPending ? 'Running...' : 'Run Processor'}
          </Button>

          {selectedPhase === 'outputStream' && (
            <Txt variant="ui-xs" className="text-accent6">
              Output Stream phase cannot be executed directly. Use streaming instead.
            </Txt>
          )}

          {result && (
            <div className="space-y-2 pt-4 border-t border-border1">
              <Txt variant="ui-sm" className="text-icon3">
                Status
              </Txt>
              <div className="flex items-center gap-2">
                <Badge variant={result.success ? 'success' : 'error'}>{result.success ? 'Success' : 'Failed'}</Badge>
                {result.tripwire?.triggered && <Badge variant="info">Tripwire Triggered</Badge>}
              </div>
              {result.tripwire?.triggered && result.tripwire.reason && (
                <div className="mt-2 p-3 bg-accent6Dark rounded-md border border-accent6/20">
                  <Txt variant="ui-sm" className="text-accent6 font-medium">
                    Tripwire Reason
                  </Txt>
                  <Txt variant="ui-sm" className="text-icon3 mt-1">
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

      <div className="p-5 h-full relative overflow-x-auto overflow-y-auto">
        <CodeMirror value={errorString || resultCode} editable={true} theme={theme} extensions={[jsonLanguage]} />
      </div>
    </MainContentContent>
  );
}

interface ProcessorInformationProps {
  processor: ProcessorDetail;
}

function ProcessorInformation({ processor }: ProcessorInformationProps) {
  return (
    <div className="px-5 pt-5 pb-4 border-b border-border1">
      <Txt variant="header-md" className="text-icon1 mb-2">
        {processor.name || processor.id}
      </Txt>
      {processor.name && processor.name !== processor.id && (
        <Txt variant="ui-sm" className="text-icon4 mb-3">
          {processor.id}
        </Txt>
      )}
      <div className="flex flex-wrap gap-1 mt-3">
        {processor.phases.map(phase => (
          <Badge key={phase} variant="default">
            {phase}
          </Badge>
        ))}
      </div>
      <div className="mt-3">
        <Txt variant="ui-xs" className="text-icon4">
          Attached to {processor.configurations.length} agent{processor.configurations.length !== 1 ? 's' : ''}
        </Txt>
      </div>
    </div>
  );
}
