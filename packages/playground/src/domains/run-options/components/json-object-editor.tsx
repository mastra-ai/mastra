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
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod/v4';

type Presets = Record<string, Record<string, unknown>>;

interface JsonObjectEditorProps {
  /** Label shown above the editor, e.g. "Request Context". */
  label: string;
  presets?: Presets | null;
  value: Record<string, any>;
  onSave: (value: Record<string, any>) => void;
  editorClassName?: string;
  labelTooltip?: string;
  headerActions?: ReactNode;
}

const jsonObjectSchema = z.record(z.string(), z.any());

function getMatchingPresetKey(presets: Presets | null | undefined, valueStr: string) {
  if (!presets) return '__custom__';

  for (const [key, value] of Object.entries(presets)) {
    if (JSON.stringify(value) === valueStr) return key;
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

export const JsonObjectEditor = ({
  label,
  presets,
  value,
  onSave,
  editorClassName = 'h-[400px]',
  labelTooltip,
  headerActions,
}: JsonObjectEditorProps) => {
  const valueStr = JSON.stringify(value ?? {});
  const formattedValue = JSON.stringify(value ?? {}, null, 2);
  const [draft, setDraft] = useState<string>(formattedValue);
  const [savedDraft, setSavedDraft] = useState<string>(formattedValue);
  const theme = useCodemirrorTheme();

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    return getMatchingPresetKey(presets, valueStr);
  });

  const { handleCopy } = useCopyToClipboard({ text: draft });

  // Re-seed synchronously when the stored value changes, so the editor never flashes empty.
  const [seededFrom, setSeededFrom] = useState(valueStr);
  if (seededFrom !== valueStr) {
    setSeededFrom(valueStr);
    setDraft(formattedValue);
    setSavedDraft(formattedValue);
    setSelectedPreset(getMatchingPresetKey(presets, valueStr));
  }

  const isDirty = useMemo(() => {
    const normalizedDraftValue = normalizeJsonString(draft);

    if (normalizedDraftValue) {
      return normalizedDraftValue !== valueStr;
    }

    return draft !== savedDraft;
  }, [valueStr, draft, savedDraft]);

  const handleSave = () => {
    let parsedContext: unknown;
    try {
      parsedContext = JSON.parse(draft);
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    const result = jsonObjectSchema.safeParse(parsedContext);
    if (!result.success) {
      toast.error(`${label} must be a JSON object`);
      return;
    }
    onSave(result.data);
  };

  const handleRevert = () => {
    setDraft(savedDraft);
    setSelectedPreset(getMatchingPresetKey(presets, valueStr));
  };

  const buttonClass = cn(quietTextHover, controlStateColorTransition);

  const handleFormat = async () => {
    if (!isValidJson(draft)) {
      toast.error('Invalid JSON');
      return;
    }

    const formatted = await formatJSON(draft);
    setDraft(formatted);
  };

  const handlePresetChange = async (presetKey: string) => {
    setSelectedPreset(presetKey);
    if (presetKey === '__custom__' || !presets) return;

    const presetValue = presets[presetKey];
    if (presetValue) {
      const formatted = await formatJSON(JSON.stringify(presetValue));
      setDraft(formatted);
    }
  };

  const handleEditorChange = (value: string) => {
    setDraft(value);
    if (selectedPreset !== '__custom__') {
      setSelectedPreset('__custom__');
    }
  };

  return (
    <TooltipProvider>
      <div>
        <div className="flex items-center justify-between pb-2">
          <RequestContextLabel as="label" tooltip={labelTooltip}>
            {label} (JSON)
          </RequestContextLabel>

          <div className="flex items-center gap-2">
            {headerActions}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleFormat} className={buttonClass}>
                  <Icon>
                    <Braces />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Format the {label} JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleCopy} className={buttonClass}>
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy {label}</TooltipContent>
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
          value={draft}
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
          {isDirty && (
            <Button
              variant="default"
              size="icon-md"
              type="button"
              tooltip={`Revert ${label} changes`}
              onClick={handleRevert}
            >
              <X />
            </Button>
          )}
          <Button icon={<Check />} type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
