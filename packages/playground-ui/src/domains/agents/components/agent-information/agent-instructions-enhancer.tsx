import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

import { githubDarkInit } from '@uiw/codemirror-theme-github';
import { useAgentPromptExperiment } from '../../context';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { RefreshCcwIcon } from 'lucide-react';
import { usePromptEnhancer } from '../../hooks/use-prompt-enhancer';
import Spinner from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { useAgent } from '../../hooks/use-agent';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { cleanProviderId } from '../agent-metadata/utils';

export const PromptEnhancer = ({ agentId }: { agentId: string }) => {
  const { isDirty, prompt, setPrompt, resetPrompt } = useAgentPromptExperiment();

  return (
    <div className="space-y-4">
      {isDirty && (
        <Alert variant="info">
          <AlertTitle as="h5">Experiment mode</AlertTitle>
          <AlertDescription as="p">
            You're editing this agent's instructions. Changes are saved locally in your browser but won't update the
            agent's code.
          </AlertDescription>

          <Button variant="light" onClick={resetPrompt}>
            <Icon>
              <RefreshCcwIcon />
            </Icon>
            Reset
          </Button>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="rounded-md bg-[#1a1a1a] p-1 font-mono">
          <CodeMirror
            value={prompt}
            editable={true}
            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping]}
            onChange={setPrompt}
            theme={githubDarkInit({
              settings: {
                caret: '#c6c6c6',
                fontFamily: 'monospace',
                background: 'transparent',
                gutterBackground: 'transparent',
                gutterForeground: '#939393',
                gutterBorder: 'none',
              },
            })}
          />
        </div>

        <PromptEnhancerTextarea agentId={agentId} />
      </div>
    </div>
  );
};

const PromptEnhancerTextarea = ({ agentId }: { agentId: string }) => {
  const { prompt, setPrompt } = useAgentPromptExperiment();
  const { mutateAsync: enhancePrompt, isPending } = usePromptEnhancer({ agentId });
  const { data: agent, isLoading: isAgentLoading, isError: isAgentError } = useAgent(agentId);
  const { data: providersData, isLoading: isProvidersLoading } = useAgentsModelProviders();

  const providers = providersData?.providers || [];

  // Check if a provider has an API key configured
  const isProviderConnected = (providerId: string) => {
    const cleanId = cleanProviderId(providerId);
    const provider = providers.find(p => cleanProviderId(p.id) === cleanId);
    return provider?.connected === true;
  };

  // Check if ANY enabled model has a connected provider
  const hasConnectedModel = () => {
    if (agent?.modelList && agent.modelList.length > 0) {
      return agent.modelList.some(m => m.enabled !== false && isProviderConnected(m.model.provider));
    }
    return agent?.provider ? isProviderConnected(agent.provider) : false;
  };

  const isDataLoading = isAgentLoading || isProvidersLoading;
  // If agent fetch errored (e.g., all models disabled), treat as no valid model
  const hasValidModel = !isDataLoading && !isAgentError && hasConnectedModel();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const userComment = formData.get('userComment') as string;
    try {
      const result = await enhancePrompt({ instructions: prompt, userComment });
      form.reset();
      setPrompt(result.new_prompt);
    } catch {
      // Error is already handled by the hook with toast
    }
  };

  const isDisabled = isPending || !hasValidModel;
  const showWarning = !isDataLoading && !hasValidModel;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        name="userComment"
        placeholder="Enter your comment here..."
        className="resize-none"
        disabled={isDisabled}
      />

      <div className="flex justify-end items-center gap-2">
        {showWarning && <span className="text-xs text-yellow-200">No model with a configured API key found.</span>}
        <Button variant="light" type="submit" disabled={isDisabled}>
          <Icon>{isPending ? <Spinner /> : <RefreshCcwIcon />}</Icon>
          Enhance prompt
        </Button>
      </div>
    </form>
  );
};
