import { MODEL_PACK_NAME_MAX } from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconStar } from '@mastra/playground-ui/icons/central/IconStar';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { modelPackNameError } from '../../../services/modelPackSet';

const packActionsVisibility =
  'pointer-fine:opacity-0 pointer-fine:group-hover/pack:opacity-100 pointer-fine:group-focus-within/pack:opacity-100 pointer-fine:aria-expanded:opacity-100';

export function ModelPackHeader({
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
