import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { DEFAULT_THINKING_LEVEL } from '@mastra/factory/default-thinking-level';
import { MODEL_PACK_MODELS_MAX } from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ALL_THINKING_LEVEL_OPTIONS, THINKING_LEVEL_LABELS } from '../../../../chat/services/thinkingLevels';
import { packNameTaken } from '../../../services/modelPackSet';
import { ModelCombobox } from '../../ModelCombobox';

const MODEL_PACK_NAME_MAX = 40;

interface EditorRow {
  key: string;
  modelId: string;
  thinkingLevel: ThinkingLevelSetting;
}

export interface ModelPackEditorProps {
  pack: ModelPack | undefined;
  packSet: ModelPackSet;
  models: AvailableModelOption[] | undefined;
  saving: boolean;
  error: string | undefined;
  onSave(pack: ModelPack): void;
  onCancel(): void;
}

function newRow(): EditorRow {
  return { key: crypto.randomUUID(), modelId: '', thinkingLevel: DEFAULT_THINKING_LEVEL };
}

function initialRows(pack: ModelPack | undefined): EditorRow[] {
  if (!pack) return [newRow()];
  return pack.models.map(model => ({ key: crypto.randomUUID(), ...model }));
}

function nameProblem(packSet: ModelPackSet, name: string, packId: string | undefined): string | undefined {
  if (!name.trim()) return 'Give the pack a name';
  if (packNameTaken(packSet, name, packId)) return 'Another pack already has this name';
  return undefined;
}

export function ModelPackEditor({ pack, packSet, models, saving, error, onSave, onCancel }: ModelPackEditorProps) {
  const baseId = useId();
  const [name, setName] = useState(pack?.name ?? '');
  const [rows, setRows] = useState(() => initialRows(pack));
  const [submitted, setSubmitted] = useState(false);
  const focusTarget = useRef<string>(undefined);

  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = undefined;
    document.getElementById(target)?.focus();
  }, [rows]);

  const nameError = submitted ? nameProblem(packSet, name, pack?.id) : undefined;
  const missingModel = rows.some(row => !row.modelId);
  const buttonId = (row: EditorRow, action: 'up' | 'down') => `${baseId}-${row.key}-${action}`;

  const update = (index: number, change: Partial<EditorRow>) =>
    setRows(current => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    focusTarget.current = buttonId(rows[from], to < from ? 'up' : 'down');
    setRows(current => {
      const next = [...current];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  };

  const optionsFor = (row: EditorRow) =>
    (models ?? []).filter(model => model.id === row.modelId || !rows.some(other => other.modelId === model.id));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (missingModel || nameProblem(packSet, name, pack?.id)) return;
    onSave({
      id: pack?.id ?? crypto.randomUUID(),
      name: name.trim(),
      models: rows.map(({ modelId, thinkingLevel }) => ({ modelId, thinkingLevel })),
    });
  };

  return (
    <form
      aria-label={pack ? `Edit ${pack.name}` : 'New pack'}
      onSubmit={submit}
      className="border-border1 flex min-w-0 flex-col gap-3 rounded-lg border p-3"
    >
      <SettingsRow label="Name" errorMsg={nameError} controlPlacement="below">
        <Input
          value={name}
          maxLength={MODEL_PACK_NAME_MAX}
          placeholder="Build"
          disabled={saving}
          onChange={event => setName(event.target.value)}
        />
      </SettingsRow>
      <ol aria-label="Models in this pack" className="flex min-w-0 flex-col gap-2">
        {rows.map((row, index) => {
          const label = index === 0 ? 'Model' : `Fallback ${index}`;
          return (
            <li key={row.key} className="flex min-w-0 items-center gap-1">
              <Txt as="span" variant="caption" tone="muted" className="w-20 shrink-0">
                {label}
              </Txt>
              <ModelCombobox
                models={optionsFor(row)}
                value={row.modelId}
                onValueChange={modelId => modelId && update(index, { modelId })}
                placeholder="Select a model"
                aria-label={label}
                size="sm"
                className="min-w-0 flex-1"
                disabled={saving}
              />
              <Select
                value={row.thinkingLevel}
                disabled={saving}
                onValueChange={value => {
                  const level = ALL_THINKING_LEVEL_OPTIONS.find(option => option.value === value)?.value;
                  if (level) update(index, { thinkingLevel: level });
                }}
              >
                <SelectTrigger size="sm" aria-label={`${label} thinking`}>
                  {THINKING_LEVEL_LABELS[row.thinkingLevel]}
                </SelectTrigger>
                <SelectContent>
                  {ALL_THINKING_LEVEL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rows.length > 1 && (
                <>
                  <Button
                    id={buttonId(row, 'up')}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    tooltip={`Move ${label.toLowerCase()} up`}
                    aria-disabled={index === 0 || undefined}
                    disabled={saving}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    id={buttonId(row, 'down')}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    tooltip={`Move ${label.toLowerCase()} down`}
                    aria-disabled={index === rows.length - 1 || undefined}
                    disabled={saving}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    tooltip={`Remove ${label.toLowerCase()}`}
                    disabled={saving}
                    onClick={() => setRows(current => current.filter((_, at) => at !== index))}
                  >
                    <TrashIcon />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length < MODEL_PACK_MODELS_MAX && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => setRows(current => [...current, newRow()])}
          >
            <IconPlusMedium />
            Add fallback
          </Button>
        </div>
      )}
      {submitted && missingModel && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          Pick a model for every row, or remove the empty ones
        </Txt>
      )}
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {error}
        </Txt>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
