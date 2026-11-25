import {
  defaultModelPack,
  LEGACY_MODEL_PACK_ID,
  legacyModelPackSet,
  MODEL_PACKS_MAX,
} from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackModel, ModelPackSet } from '@mastra/factory/model-packs';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { useRef, useState } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ListHeading } from '../ListHeading';
import { withPackRemoved, withPackSaved } from '../../../services/modelPackSet';
import { ModelPackEditor } from './ModelPackEditor';
import { ModelPackHeader } from './ModelPackHeader';
import { ModelPackTimeline } from './ModelPackTimeline';
import { PACK_CARD_CLASS, PACK_HEADER_CLASS, PACK_LIST_CLASS } from './packLayout';

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
        className={cn('group/pack', PACK_CARD_CLASS)}
      >
        <div className={PACK_HEADER_CLASS}>
          <ModelPackHeader
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
    <div role="group" aria-label={label} className={PACK_LIST_CLASS}>
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
