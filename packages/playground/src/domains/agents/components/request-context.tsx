import { jsonLanguage } from '@codemirror/lang-json';
import { Button } from '@mastra/playground-ui/components/Button';
import { useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { RequestContextLabel } from '@mastra/playground-ui/domains/request-context/components/request-context-label';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatJSON, isValidJson } from '@mastra/playground-ui/utils/formatting';
import { toast } from '@mastra/playground-ui/utils/toast';
import CodeMirror from '@uiw/react-codemirror';
import { Braces, CopyIcon, X, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod/v4';
import type { RequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';
import { useRequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';

interface RequestContextProps {
  value: Record<string, any>;
  onSave: (value: Record<string, any>) => void;
  editorClassName?: string;
  labelTooltip?: string;
}

const requestContextObjectSchema = z.record(z.string(), z.any());

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

export const RequestContext = ({
  value: requestContext,
  onSave,
  editorClassName = 'h-[400px]',
  labelTooltip,
}: RequestContextProps) => {
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

    let parsedContext: unknown;
    try {
      parsedContext = JSON.parse(requestContextValue);
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    const result = requestContextObjectSchema.safeParse(parsedContext);
    if (!result.success) {
      toast.error('Request context must be a JSON object');
      return;
    }
    onSave(result.data);
  };

  const handleRevertRequestContext = () => {
    setRequestContextValue(savedRequestContextValue);
    setSelectedPreset(getMatchingPresetKey(presets, requestContextStr));
  };

  const buttonClass = cn(quietTextHover, controlStateColorTransition);

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
            'overflow-hidden overflow-y-scroll rounded-lg border border-border bg-background p-3',
            '[&_.cm-editor]:!bg-background [&_.cm-gutters]:!bg-background',
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
          <Button icon={<Check />} type="button" onClick={handleSaveRequestContext} disabled={!isRequestContextDirty}>
            Save
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
