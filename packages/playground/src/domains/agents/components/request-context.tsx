import { jsonLanguage } from '@codemirror/lang-json';
import { Icon, formatJSON, isValidJson, toast } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import { useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { cn } from '@mastra/playground-ui/utils/cn';
import CodeMirror from '@uiw/react-codemirror';
import { Braces, CopyIcon, ExternalLink, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { RequestContextLabel } from '@/domains/request-context/components/request-context-label';
import type { RequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';
import { useRequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';

import { useLinkComponent } from '@/lib/framework';
import { usePlaygroundStore } from '@/store/playground-store';

interface RequestContextProps {
  editorClassName?: string;
  labelTooltip?: string;
}

function getMatchingPresetKey(presets: RequestContextPresets | null, requestContextStr: string) {
  if (!presets) return '__custom__';

  for (const [key, value] of Object.entries(presets)) {
    if (JSON.stringify(value) === requestContextStr) return key;
  }

  return '__custom__';
}

function normalizeJsonString(value: string) {
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return null;
  }
}

export const RequestContext = ({ editorClassName = 'h-[400px]', labelTooltip }: RequestContextProps = {}) => {
  const { requestContext, setRequestContext } = usePlaygroundStore();
  const [requestContextValue, setRequestContextValue] = useState<string>('');
  const [savedRequestContextValue, setSavedRequestContextValue] = useState<string>('');
  const theme = useCodemirrorTheme();
  const presets = useRequestContextPresets();
  const requestContextStr = JSON.stringify(requestContext ?? {});

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    return getMatchingPresetKey(presets, requestContextStr);
  });

  const { handleCopy } = useCopyToClipboard({ text: requestContextValue });

  useEffect(() => {
    const run = async () => {
      if (!isValidJson(requestContextStr)) {
        toast.error('Invalid JSON');
        return;
      }

      const formatted = await formatJSON(requestContextStr);
      setRequestContextValue(formatted);
      setSavedRequestContextValue(formatted);
      setSelectedPreset(getMatchingPresetKey(presets, requestContextStr));
    };

    void run();
  }, [presets, requestContextStr]);

  const isRequestContextDirty = useMemo(() => {
    const normalizedDraftValue = normalizeJsonString(requestContextValue);

    if (normalizedDraftValue) {
      return normalizedDraftValue !== requestContextStr;
    }

    return requestContextValue !== savedRequestContextValue;
  }, [requestContextStr, requestContextValue, savedRequestContextValue]);

  const handleSaveRequestContext = () => {
    if (!isRequestContextDirty) return;

    try {
      const parsedContext = JSON.parse(requestContextValue);
      setRequestContext(parsedContext);
      toast.success('Request context saved successfully');
    } catch (error) {
      console.error('error', error);
      toast.error('Invalid JSON');
    }
  };

  const handleRevertRequestContext = () => {
    setRequestContextValue(savedRequestContextValue);
    setSelectedPreset(getMatchingPresetKey(presets, requestContextStr));
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
          <RequestContextLabel as="label" tooltip={labelTooltip}>
            Request Context (JSON)
          </RequestContextLabel>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={formatRequestContext} className={buttonClass}>
                  <Icon>
                    <Braces />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Format the Request Context JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleCopy} className={buttonClass}>
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
          className={cn(
            editorClassName,
            'overflow-y-scroll rounded-lg border border-border1 bg-surface2 overflow-hidden p-3',
            '[&_.cm-editor]:!bg-surface2 [&_.cm-gutters]:!bg-surface2',
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          {isRequestContextDirty && (
            <Button
              variant="default"
              size="icon-md"
              type="button"
              tooltip="Revert request context changes"
              onClick={handleRevertRequestContext}
            >
              <X />
            </Button>
          )}
          <Button type="button" onClick={handleSaveRequestContext} disabled={!isRequestContextDirty}>
            Save
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export const RequestContextWrapper = ({ children }: { children: ReactNode }) => {
  const { Link } = useLinkComponent();

  return (
    <div>
      <Notice
        variant="note"
        title="Request context"
        className="mb-5"
        action={
          <Notice.Button as={Link} to="https://mastra.ai/docs/server/request-context" target="_blank">
            <Icon>
              <ExternalLink />
            </Icon>
            See documentation
          </Notice.Button>
        }
      >
        <Notice.Message>
          Mastra provides request context, which is a system based on dependency injection that enables you to configure
          your agents and tools with runtime variables. If you find yourself creating several different agents that do
          very similar things, request context allows you to combine them into one agent.
        </Notice.Message>
      </Notice>
      {children}
    </div>
  );
};
