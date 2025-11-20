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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const userComment = formData.get('userComment') as string;
    const result = await enhancePrompt({ instructions: prompt, userComment });
    form.reset();
    setPrompt(result.new_prompt);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input name="userComment" placeholder="Enter your comment here..." className="resize-none" disabled={isPending} />

      <div className="flex justify-end">
        <Button variant="light" type="submit" disabled={isPending}>
          <Icon>{isPending ? <Spinner /> : <RefreshCcwIcon />}</Icon>
          Enhance prompt
        </Button>
      </div>
    </form>
  );
};
