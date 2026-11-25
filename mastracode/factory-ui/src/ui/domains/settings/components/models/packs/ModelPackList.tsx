import {
  defaultModelPack,
  LEGACY_MODEL_PACK_ID,
  legacyModelPackSet,
  MODEL_PACK_NAME_MAX,
  MODEL_PACKS_MAX,
} from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackModel, ModelPackSet } from '@mastra/factory/model-packs';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { IconStar } from '@mastra/playground-ui/icons/central/IconStar';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ListHeading } from '../ListHeading';
import { modelPackNameError, withPackRemoved, withPackSaved } from '../../../services/modelPackSet';
import { ModelPackEditor } from './ModelPackEditor';
import { ModelPackTimeline } from './ModelPackTimeline';

const packActionsVisibility =
  'pointer-fine:opacity-0 pointer-fine:group-hover/pack:opacity-100 pointer-fine:group-focus-within/pack:opacity-100 pointer-fine:aria-expanded:opacity-100';

function emptyPacksNote(startModelId: string | null | undefined): string {
  if (startModelId)
    return `No model packs yet. New sessions start on ${formatModelName(startModelId)}, with no fallbacks.`;
  if (startModelId === null) {
    return 'No model packs yet, and no start model is available here.';
  }
  return 'No model packs yet.';
}

export interface ModelPackListProps {
  label: string;
  packSet: ModelPackSet;
  models: AvailableModelOption[] | undefined;
  startModelId?: string | null;
  readOnly: boolean;
  saving: boolean;
  error: string | undefined;
  onSave(next: ModelPackSet): Promise<unknown>;
}

export function ModelPackList({
  label,
  packSet,
  models,
  startModelId,
  readOnly,
  saving,
  error,
  onSave,
}: ModelPackListProps) {
  const [creating, setCreating] = useState(false);
  const [showOtherPacks, setShowOtherPacks] = useState(false);
  const defaultPackList = useRef<HTMLUListElement>(null);
  const focusAfterCreate = useRef<{ kind: 'cancel' } | { kind: 'save'; packId: string } | null>(null);
  const packs = packSet.modelPacks;
  const defaultPack = defaultModelPack(packSet);
  const otherPacks = packs.filter(pack => pack.id !== defaultPack?.id);
  const disabled = saving || creating;

  const save = (next: ModelPackSet) =>
    onSave(next).then(
      () => true,
      () => false,
    );
  const savePack = (pack: ModelPack) => save(withPackSaved(packSet, pack));
  const makeDefault = async (packId: string) => {
    if (await save({ ...packSet, defaultModelPackId: packId })) defaultPackList.current?.focus();
  };
  const createPack = async (pack: ModelPack) => {
    if (!(await savePack(pack))) return;
    focusAfterCreate.current = { kind: 'save', packId: pack.id };
    setCreating(false);
    if (defaultPack) setShowOtherPacks(true);
  };
  const createFirstPack = async ([first]: ModelPackModel[]) => {
    if (!first) return;
    focusAfterCreate.current = { kind: 'save', packId: LEGACY_MODEL_PACK_ID };
    if (!(await save(legacyModelPackSet(first.modelId, first.thinkingLevel)))) focusAfterCreate.current = null;
  };
  const renderPack = (pack: ModelPack) => {
    const isDefault = pack.id === defaultPack?.id;
    return (
      <li
        key={pack.id}
        aria-label={pack.name}
        tabIndex={-1}
        ref={row => {
          const target = focusAfterCreate.current;
          if (row && !disabled && target?.kind === 'save' && target.packId === pack.id) {
            focusAfterCreate.current = null;
            row.focus();
          }
        }}
        className="group/pack bg-nested flex min-w-0 flex-col rounded-lg p-2"
      >
        <div className="min-h-control-sm flex min-w-0 items-center justify-between gap-1">
          <PackHeader
            pack={pack}
            packSet={packSet}
            readOnly={readOnly}
            isDefault={isDefault}
            canDelete={!isDefault || otherPacks.length === 0}
            disabled={disabled}
            onSave={savePack}
            onMakeDefault={() => void makeDefault(pack.id)}
            onDelete={() => void save(withPackRemoved(packSet, pack.id))}
          />
        </div>
        <ModelPackTimeline
          entries={pack.models}
          models={models}
          disabled={disabled}
          onChange={readOnly ? undefined : entries => savePack({ ...pack, models: entries })}
        />
      </li>
    );
  };

  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1">
      <ListHeading label="Model packs">
        {!readOnly && !creating && packs.length > 0 && (
          <Button
            size="icon-sm"
            variant="ghost"
            tooltip="New pack"
            ref={button => {
              if (button && focusAfterCreate.current?.kind === 'cancel') {
                focusAfterCreate.current = null;
                button.focus();
              }
            }}
            disabled={saving || packs.length >= MODEL_PACKS_MAX}
            onClick={() => setCreating(true)}
          >
            <IconPlusMedium />
          </Button>
        )}
      </ListHeading>
      {!readOnly && !creating && packs.length >= MODEL_PACKS_MAX && (
        <Txt as="p" variant="caption" tone="muted">
          Up to {MODEL_PACKS_MAX} packs. Delete one to add another.
        </Txt>
      )}
      {!readOnly && creating && (
        <ModelPackEditor
          packSet={packSet}
          models={models}
          saving={saving}
          error={error}
          onSave={pack => void createPack(pack)}
          onCancel={() => {
            focusAfterCreate.current = { kind: 'cancel' };
            setCreating(false);
          }}
        />
      )}
      {packs.length === 0 && !creating && (
        <>
          <Txt as="p" variant="caption" tone="muted">
            {emptyPacksNote(startModelId)}
          </Txt>
          {!readOnly && (
            <ModelPackTimeline
              entries={[]}
              models={models}
              disabled={disabled}
              onChange={entries => createFirstPack(entries)}
            />
          )}
        </>
      )}
      {defaultPack && (
        <ul aria-label="Default pack" tabIndex={-1} ref={defaultPackList}>
          {renderPack(defaultPack)}
        </ul>
      )}
      {otherPacks.length > 0 && (
        <Collapsible open={showOtherPacks} onOpenChange={setShowOtherPacks}>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="sm" className="w-full justify-between" iconEnd={<DisclosureChevron />}>
                Other packs ({otherPacks.length})
              </Button>
            }
          />
          <CollapsibleContent className="pt-1">
            <ul aria-label="Other packs" className="flex flex-col gap-2">
              {otherPacks.map(renderPack)}
            </ul>
          </CollapsibleContent>
        </Collapsible>
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

function PackHeader({
  pack,
  packSet,
  readOnly,
  isDefault,
  canDelete,
  disabled,
  onSave,
  onMakeDefault,
  onDelete,
}: {
  pack: ModelPack;
  packSet: ModelPackSet;
  readOnly?: boolean;
  isDefault: boolean;
  canDelete: boolean;
  disabled: boolean;
  onSave: (pack: ModelPack) => Promise<boolean>;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const renameChosen = useRef(false);
  const restoreFocus = useRef(false);
  if (renaming) {
    return (
      <PackNameForm
        pack={pack}
        packSet={packSet}
        disabled={disabled}
        onSave={onSave}
        onClose={() => {
          renameChosen.current = false;
          restoreFocus.current = true;
          setRenaming(false);
        }}
      />
    );
  }

  return (
    <>
      <Txt as="span" variant="caption" tone="muted" className="min-w-0 px-3 py-1 wrap-break-word">
        {pack.name}
      </Txt>
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${pack.name} actions`}
                tooltip={`${pack.name} actions`}
                disabled={disabled}
                className={cn('shrink-0', packActionsVisibility)}
                ref={button => {
                  if (button && restoreFocus.current) {
                    restoreFocus.current = false;
                    button.focus();
                  }
                }}
              >
                <IconDotGrid1x3Horizontal />
              </Button>
            }
          />
          <DropdownMenu.Content align="end" finalFocus={() => !renameChosen.current}>
            <DropdownMenu.Item
              onClick={() => {
                renameChosen.current = true;
                setRenaming(true);
              }}
            >
              <IconPencil /> Rename
            </DropdownMenu.Item>
            {!isDefault && (
              <DropdownMenu.Item onClick={onMakeDefault}>
                <IconStar /> Make default
              </DropdownMenu.Item>
            )}
            {canDelete && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item variant="destructive" onClick={onDelete}>
                  <TrashIcon /> Delete pack
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
    </>
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
      className="flex min-w-0 flex-1 flex-col gap-1"
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
