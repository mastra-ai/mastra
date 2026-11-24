import { MODEL_PACK_NAME_MAX, MODEL_PACKS_MAX } from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { modelPackNameError, withPackRemoved, withPackSaved } from '../../../services/modelPackSet';
import { ModelPackEditor } from './ModelPackEditor';
import { ModelPackTimeline } from './ModelPackTimeline';

export interface ModelPackListProps {
  label: string;
  packSet: ModelPackSet;
  models: AvailableModelOption[] | undefined;
  readOnly: boolean;
  saving: boolean;
  error: string | undefined;
  onSave(next: ModelPackSet): Promise<unknown>;
}

export function ModelPackList({ label, packSet, models, readOnly, saving, error, onSave }: ModelPackListProps) {
  const [creating, setCreating] = useState(false);
  const packs = packSet.modelPacks;
  const disabled = saving || creating;

  const save = (next: ModelPackSet) =>
    onSave(next).then(
      () => true,
      () => false,
    );
  const savePack = (pack: ModelPack) => save(withPackSaved(packSet, pack));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {packs.length === 0 && !creating && (
        <Txt as="p" variant="caption" tone="muted">
          No model packs yet. Sessions use the built-in default model.
        </Txt>
      )}
      {packs.length > 0 && (
        <ul aria-label={label} className="divide-border1 flex min-w-0 flex-col divide-y">
          {packs.map(pack => {
            const isDefault = pack.id === packSet.defaultModelPackId;
            return (
              <li key={pack.id} aria-label={pack.name} className="py-2 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-1">
                    <div className="flex min-w-0 items-center gap-1">
                      {readOnly ? (
                        <Txt as="span" variant="label" className="min-w-0 wrap-break-word">
                          {pack.name}
                        </Txt>
                      ) : (
                        <PackName pack={pack} packSet={packSet} disabled={disabled} onSave={savePack} />
                      )}
                      {isDefault && <Badge>Default</Badge>}
                    </div>
                    {!readOnly && (
                      <div className="ml-auto flex items-center">
                        {!isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Make ${pack.name} the default`}
                            disabled={disabled}
                            onClick={() => void save({ ...packSet, defaultModelPackId: pack.id })}
                          >
                            Make default
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          tooltip={`Delete ${pack.name}`}
                          disabled={disabled || (isDefault && packs.length > 1)}
                          onClick={() => void save(withPackRemoved(packSet, pack.id))}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    )}
                  </div>
                  <ModelPackTimeline
                    entries={pack.models}
                    models={models}
                    disabled={disabled}
                    onChange={readOnly ? undefined : entries => void savePack({ ...pack, models: entries })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && creating && (
        <ModelPackEditor
          packSet={packSet}
          models={models}
          saving={saving}
          error={error}
          onSave={pack => void savePack(pack).then(saved => saved && setCreating(false))}
          onCancel={() => setCreating(false)}
        />
      )}
      {!readOnly && !creating && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<IconPlusMedium />}
            disabled={saving || packs.length >= MODEL_PACKS_MAX}
            onClick={() => setCreating(true)}
          >
            New pack
          </Button>
          {packs.length >= MODEL_PACKS_MAX && (
            <Txt as="span" variant="caption" tone="muted">
              Up to {MODEL_PACKS_MAX} packs. Delete one to add another.
            </Txt>
          )}
        </div>
      )}
      {readOnly && (
        <Txt as="p" variant="caption" tone="muted">
          Only organization admins can change these packs.
        </Txt>
      )}
      {saving && (
        <Txt as="p" variant="caption" tone="muted" role="status">
          Saving model packs…
        </Txt>
      )}
      {!creating && error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {error}
        </Txt>
      )}
    </div>
  );
}

function PackName({
  pack,
  packSet,
  disabled,
  onSave,
}: {
  pack: ModelPack;
  packSet: ModelPackSet;
  disabled: boolean;
  onSave: (pack: ModelPack) => Promise<boolean>;
}) {
  const [renaming, setRenaming] = useState(false);
  const restoreFocus = useRef(false);
  if (!renaming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        iconEnd={<IconPencil />}
        disabled={disabled}
        aria-label={`Rename ${pack.name}`}
        onClick={() => setRenaming(true)}
        ref={button => {
          if (button && restoreFocus.current) {
            restoreFocus.current = false;
            button.focus();
          }
        }}
        className="min-w-0"
      >
        <span className="truncate">{pack.name}</span>
      </Button>
    );
  }

  return (
    <PackNameForm
      pack={pack}
      packSet={packSet}
      disabled={disabled}
      onSave={onSave}
      onClose={() => {
        restoreFocus.current = true;
        setRenaming(false);
      }}
    />
  );
}

function focusInput(input: HTMLInputElement | null) {
  input?.focus();
}

function PackNameForm({
  pack,
  packSet,
  disabled,
  onSave,
  onClose,
}: {
  pack: ModelPack;
  packSet: ModelPackSet;
  disabled: boolean;
  onSave: (pack: ModelPack) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(pack.name);
  const [submitted, setSubmitted] = useState(false);
  const nameError = modelPackNameError(packSet, name, pack.id);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    setSubmitted(true);
    if (nameError) return;
    const trimmed = name.trim();
    if (trimmed === pack.name) {
      onClose();
      return;
    }
    void onSave({ ...pack, name: trimmed }).then(saved => saved && onClose());
  };

  return (
    <form
      aria-label={`Rename ${pack.name}`}
      onSubmit={submit}
      onKeyDown={event => {
        if (event.key === 'Escape' && !disabled) onClose();
      }}
      className="flex min-w-0 flex-col gap-1"
    >
      <div className="flex min-w-0 items-center gap-1">
        <Input
          ref={focusInput}
          size="sm"
          value={name}
          maxLength={MODEL_PACK_NAME_MAX}
          aria-label="Pack name"
          aria-invalid={submitted && Boolean(nameError)}
          disabled={disabled}
          onChange={event => setName(event.target.value)}
        />
        <Button type="submit" size="icon-sm" variant="ghost" tooltip="Save name" disabled={disabled}>
          <IconCheckmark2Medium />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          tooltip="Cancel rename"
          disabled={disabled}
          onClick={onClose}
        >
          <IconCrossMedium />
        </Button>
      </div>
      {submitted && nameError && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {nameError}
        </Txt>
      )}
    </form>
  );
}
