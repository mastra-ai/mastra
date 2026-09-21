import { jsonLanguage } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { Braces, CopyIcon, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useRequestContext } from '../context/request-context-provider';
import type { RequestContextPresets } from '../hooks/use-request-context-presets';
import { useRequestContextPresets } from '../hooks/use-request-context-presets';
import { RequestContextLabel } from './request-context-label';
import { useRunOptionsDraft } from '@/domains/run-options/context/run-options-draft';
import { Button } from '@/ds/components/Button';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export interface RequestContextJsonEditorProps {
  editorClassName?: string;
  labelTooltip?: string;
}

const CUSTOM_PRESET = '__custom__';

function getMatchingPresetKey(presets: RequestContextPresets | null, requestContextStr: string) {
  if (!presets) return CUSTOM_PRESET;

  for (const [key, value] of Object.entries(presets)) {
    if (JSON.stringify(value) === requestContextStr) return key;
  }

  return CUSTOM_PRESET;
}

function normalizeJsonString(value: string) {
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return null;
  }
}

/** Freeform JSON editor bound to the current entity request context. */
export const RequestContextJsonEditor = ({
  editorClassName = 'h-[400px]',
  labelTooltip,
}: RequestContextJsonEditorProps = {}) => {
  const { requestContext, setRequestContext } = useRequestContext();
  const [requestContextValue, setRequestContextValue] = useState<string>('');
  const [savedRequestContextValue, setSavedRequestContextValue] = useState<string>('');
  const theme = useCodemirrorTheme();
  const presets = useRequestContextPresets();
  const requestContextStr = JSON.stringify(requestContext ?? {});

  const [selectedPreset, setSelectedPreset] = useState<string>(() => getMatchingPresetKey(presets, requestContextStr));

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

  useRunOptionsDraft({
    isDirty: isRequestContextDirty,
    save: () => {
      try {
        setRequestContext(JSON.parse(requestContextValue));
        return true;
      } catch {
        toast.error('Invalid request context JSON');
        return false;
      }
    },
  });

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
    if (presetKey === CUSTOM_PRESET || !presets) return;

    const presetValue = presets[presetKey];
    if (presetValue) {
      const formatted = await formatJSON(JSON.stringify(presetValue));
      setRequestContextValue(formatted);
    }
  };

  const handleEditorChange = (value: string) => {
    setRequestContextValue(value);
    if (selectedPreset !== CUSTOM_PRESET) {
      setSelectedPreset(CUSTOM_PRESET);
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
              <TooltipTrigger
                render={
                  <button type="button" onClick={formatRequestContext} className={buttonClass}>
                    <Icon>
                      <Braces />
                    </Icon>
                  </button>
                }
              />
              <TooltipContent>Format the Request Context JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button type="button" onClick={handleCopy} className={buttonClass}>
                    <Icon>
                      <CopyIcon />
                    </Icon>
                  </button>
                }
              />
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
                <SelectItem value={CUSTOM_PRESET}>Custom</SelectItem>
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
            'overflow-hidden overflow-y-scroll rounded-lg border border-border1 bg-surface2 p-3',
            '[&_.cm-editor]:!bg-surface2 [&_.cm-gutters]:!bg-surface2',
          )}
        />

        {isRequestContextDirty && (
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              size="icon-md"
              type="button"
              tooltip="Revert request context changes"
              onClick={handleRevertRequestContext}
            >
              <X />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
