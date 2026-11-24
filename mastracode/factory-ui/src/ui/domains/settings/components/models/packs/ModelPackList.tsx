import { MODEL_PACKS_MAX } from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { SettingsItem } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { modelPackChain } from '../../../../chat/services/modelPacks';
import { withPackRemoved, withPackSaved } from '../../../services/modelPackSet';
import { ModelPackEditor } from './ModelPackEditor';

export interface ModelPackListProps {
  label: string;
  packSet: ModelPackSet;
  models: AvailableModelOption[] | undefined;
  readOnly: boolean;
  saving: boolean;
  error: string | undefined;
  onSave(next: ModelPackSet): Promise<unknown>;
}

interface PackEditing {
  packId: string | undefined;
}

export function ModelPackList({ label, packSet, models, readOnly, saving, error, onSave }: ModelPackListProps) {
  const [editing, setEditing] = useState<PackEditing>();
  const packs = packSet.modelPacks;

  const save = (next: ModelPackSet) =>
    onSave(next).then(
      () => setEditing(undefined),
      () => undefined,
    );

  const editor = (pack: ModelPack | undefined) => (
    <ModelPackEditor
      pack={pack}
      packSet={packSet}
      models={models}
      saving={saving}
      error={error}
      onSave={saved => save(withPackSaved(packSet, saved))}
      onCancel={() => setEditing(undefined)}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {packs.length === 0 && !editing && (
        <Txt as="p" variant="caption" tone="muted">
          No model packs yet. Sessions use the built-in default model.
        </Txt>
      )}
      {packs.length > 0 && (
        <ul aria-label={label} className="flex min-w-0 flex-col gap-3">
          {packs.map(pack => {
            const isDefault = pack.id === packSet.defaultModelPackId;
            if (editing?.packId === pack.id) return <li key={pack.id}>{editor(pack)}</li>;
            return (
              <li key={pack.id} aria-label={pack.name}>
                <SettingsItem
                  title={
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{pack.name}</span>
                      {isDefault && <Badge>Default</Badge>}
                    </span>
                  }
                  description={modelPackChain(pack)}
                >
                  {!readOnly && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${pack.name}`}
                        disabled={saving || Boolean(editing)}
                        onClick={() => setEditing({ packId: pack.id })}
                      >
                        Edit
                      </Button>
                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Make ${pack.name} the default`}
                          disabled={saving}
                          onClick={() => void save({ ...packSet, defaultModelPackId: pack.id })}
                        >
                          Make default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${pack.name}`}
                        disabled={saving || (isDefault && packs.length > 1)}
                        onClick={() => void save(withPackRemoved(packSet, pack.id))}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </SettingsItem>
              </li>
            );
          })}
        </ul>
      )}
      {editing && editing.packId === undefined && editor(undefined)}
      {!readOnly && !editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={saving || packs.length >= MODEL_PACKS_MAX}
            onClick={() => setEditing({ packId: undefined })}
          >
            <IconPlusMedium />
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
      {!editing && error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {error}
        </Txt>
      )}
    </div>
  );
}
