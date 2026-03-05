import { ReactNode, useEffect, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { toast } from '@/lib/toast';
import { Txt } from '@/ds/components/Txt';
import { usePlaygroundStore } from '@/store/playground-store';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

import CodeMirror from '@uiw/react-codemirror';
import { jsonLanguage } from '@codemirror/lang-json';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Braces, CopyIcon, ExternalLink } from 'lucide-react';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { useLinkComponent } from '@/lib/framework';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select/select';
import { useRequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';

export const RequestContext = () => {
  const { requestContext, setRequestContext } = usePlaygroundStore();
  const [requestContextValue, setRequestContextValue] = useState<string>('');
  const theme = useCodemirrorTheme();
  const presets = useRequestContextPresets();

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (!presets || !requestContext) return '__custom__';
    const savedStr = JSON.stringify(requestContext);
    for (const [key, value] of Object.entries(presets)) {
      if (JSON.stringify(value) === savedStr) return key;
    }
    return '__custom__';
  });

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

  const buttonClass = 'text-neutral3 hover:text-neutral6';

  const formatRequestContext = async () => {
    if (!isValidJson(requestContextValue)) {
      toast.error('Invalid JSON');
      return;
    }

    const formatted = await formatJSON(requestContextValue);
    setRequestContextValue(formatted);
  };

  const handlePresetChange = async (presetKey: string) => {
    setSelectedPreset(presetKey);
    if (presetKey === '__custom__' || !presets) return;

    const presetValue = presets[presetKey];
    if (presetValue) {
      const formatted = await formatJSON(JSON.stringify(presetValue));
      setRequestContextValue(formatted);
    }
  };

  const handleEditorChange = (value: string) => {
    setRequestContextValue(value);
    if (selectedPreset !== '__custom__') {
      setSelectedPreset('__custom__');
    }
  };

  return (
    <TooltipProvider>
      <div>
        <div className="flex items-center justify-between pb-2">
          <Txt as="label" variant="ui-md" className="text-neutral3">
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

        {presets && Object.keys(presets).length > 0 && (
          <div className="pb-3">
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a preset..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">Custom</SelectItem>
                {Object.keys(presets).map(key => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <CodeMirror
          value={requestContextValue}
          onChange={handleEditorChange}
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
        <Txt as="p" variant="ui-lg" className="text-neutral3">
          Mastra provides request context, which is a system based on dependency injection that enables you to configure
          your agents and tools with runtime variables. If you find yourself creating several different agents that do
          very similar things, request context allows you to combine them into one agent.
        </Txt>

        <Button as={Link} to="https://mastra.ai/docs/server/request-context" target="_blank">
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
