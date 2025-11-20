import { ReactNode, useEffect, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { toast } from 'sonner';
import { Txt } from '@/ds/components/Txt';
import { usePlaygroundStore } from '@/store/playground-store';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

import CodeMirror from '@uiw/react-codemirror';
import { jsonLanguage } from '@codemirror/lang-json';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Braces, CopyIcon, ExternalLink } from 'lucide-react';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { useLinkComponent } from '@/lib/framework';

export const RequestContext = () => {
  const { requestContext, setRequestContext } = usePlaygroundStore();
  const [requestContextValue, setRequestContextValue] = useState<string>('');
  const theme = useCodemirrorTheme();

  const { handleCopy } = useCopyToClipboard({ text: requestContextValue });

  const requestContextStr = JSON.stringify(requestContext);

  useEffect(() => {
    const run = async () => {
      if (!isValidJson(requestContextStr)) {
        toast.error('Invalid JSON');
        return;
      }

      const formatted = await formatJSON(requestContextStr);
      setRequestContextValue(formatted);
    };

    run();
  }, [requestContextStr]);

  const handleSaveRequestContext = () => {
    try {
      const parsedContext = JSON.parse(requestContextValue);
      setRequestContext(parsedContext);
      toast.success('Request context saved successfully');
    } catch (error) {
      console.error('error', error);
      toast.error('Invalid JSON');
    }
  };

  const buttonClass = 'text-icon3 hover:text-icon6';

  const formatRequestContext = async () => {
    if (!isValidJson(requestContextValue)) {
      toast.error('Invalid JSON');
      return;
    }

    const formatted = await formatJSON(requestContextValue);
    setRequestContextValue(formatted);
  };

  return (
    <TooltipProvider>
      <div>
        <div className="flex items-center justify-between pb-2">
          <Txt as="label" variant="ui-md" className="text-icon3">
            Request Context (JSON)
          </Txt>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={formatRequestContext} className={buttonClass}>
                  <Icon>
                    <Braces />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Format the Request Context JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleCopy} className={buttonClass}>
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy Request Context</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <CodeMirror
          value={requestContextValue}
          onChange={setRequestContextValue}
          theme={theme}
          extensions={[jsonLanguage]}
          className="h-[400px] overflow-y-scroll bg-surface3 rounded-lg overflow-hidden p-3"
        />

        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveRequestContext}>Save</Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export const RequestContextWrapper = ({ children }: { children: ReactNode }) => {
  const { Link } = useLinkComponent();

  return (
    <div className="max-w-3xl p-5 overflow-y-scroll h-full">
      <div className="rounded-lg p-4 pb-5 bg-surface4 shadow-md space-y-3 border border-border1 mb-5">
        <Txt as="p" variant="ui-lg" className="text-icon3">
          Mastra provides request context, which is a system based on dependency injection that enables you to configure
          your agents and tools with runtime variables. If you find yourself creating several different agents that do
          very similar things, request context allows you to combine them into one agent.
        </Txt>

        <Button as={Link} to="https://mastra.ai/en/docs/agents/runtime-variables" target="_blank">
          <Icon>
            <ExternalLink />
          </Icon>
          See documentation
        </Button>
      </div>
      {children}
    </div>
  );
};
