import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Check, Hammer, Map, Plus, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import {
  useActivateModelPack,
  useModelPacksQuery,
  useRemoveModelPack,
  useSaveModelPack,
} from '../../../../../shared/hooks/use-model-packs';
import type { AvailableModelOption } from '../../../../../shared/hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from './ModelCombobox';

interface DraftPack {
  name: string;
  build: string;
  plan: string;
  fast: string;
}

const EMPTY_DRAFT: DraftPack = { name: '', build: '', plan: '', fast: '' };

interface ModelAssignmentProps {
  description: string;
  icon: LucideIcon;
  label: string;
  model: string;
}

function ModelAssignment({ description, icon: Icon, label, model }: ModelAssignmentProps) {
  return (
    <span className="flex max-w-full min-w-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              aria-label={`${label}: ${description}`}
              className="focus-visible:ring-accent1 inline-flex size-5 shrink-0 items-center justify-center rounded-md outline-hidden focus-visible:ring-2"
              tabIndex={0}
            >
              <Icon aria-hidden size={12} className="text-icon3" />
            </span>
          }
        />
        <TooltipContent>
          {label}: {description}
        </TooltipContent>
      </Tooltip>
      <Txt as="span" variant="ui-xs" className="text-icon3 truncate">
        {model || '—'}
      </Txt>
    </span>
  );
}

/**
 * Model packs. Mirrors the TUI's `/models-pack` command: a pack assigns a model
 * to each mode (build / plan / fast). Built-in packs are gated by provider
 * access; custom packs are user-defined. Activating a pack seeds the current
 * session's per-mode models — so it needs the active factory's resourceId (and
 * the session scope the web chat session was registered under).
 */
export function ModelPacksSection({
  resourceId,
  scope,
  models,
}: {
  resourceId?: string;
  scope?: string;
  models: AvailableModelOption[];
}) {
  const packsQuery = useModelPacksQuery(resourceId, scope);
  const activateMutation = useActivateModelPack(resourceId, scope);
  const removeMutation = useRemoveModelPack();
  const saveMutation = useSaveModelPack();

  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPack | null>(null);

  const packs = packsQuery.data?.packs ?? [];
  const loading = packsQuery.isPending;
  const busy = activateMutation.isPending || removeMutation.isPending || saveMutation.isPending;
  const queryError = packsQuery.error instanceof Error ? packsQuery.error.message : null;
  const error = draftError ?? queryError;

  const activate = async (id: string) => {
    if (!resourceId) {
      setDraftError('Open a factory first to activate a pack.');
      return;
    }
    setDraftError(null);
    try {
      await activateMutation.mutateAsync({ id });
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (id: string) => {
    setDraftError(null);
    try {
      await removeMutation.mutateAsync({ id });
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name || !draft.build || !draft.plan || !draft.fast) {
      setDraftError('Name and a model for each of build, plan and fast are required.');
      return;
    }
    setDraftError(null);
    try {
      await saveMutation.mutateAsync({ name, models: { build: draft.build, plan: draft.plan, fast: draft.fast } });
      setDraft(null);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    }
  };

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <ModelCombobox models={models} value={value} onValueChange={onChange} />
  );

  return (
    <div className="flex flex-col gap-3">
      {!resourceId && (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Open a factory to activate a pack on its session.
        </Txt>
      )}
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      {draft && (
        <div className="border-border1 flex flex-col gap-3 rounded-lg border p-3">
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Name
            </Txt>
            <Input
              size="sm"
              placeholder="e.g. my-pack"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Build model
            </Txt>
            {modelSelect(draft.build, v => setDraft({ ...draft, build: v }))}
          </label>
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Plan model
            </Txt>
            {modelSelect(draft.plan, v => setDraft({ ...draft, plan: v }))}
          </label>
          <label className="flex flex-col gap-1">
            <Txt as="span" variant="ui-sm" className="text-icon5">
              Fast model
            </Txt>
            {modelSelect(draft.fast, v => setDraft({ ...draft, fast: v }))}
          </label>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void saveDraft()}>
              Add
            </Button>
            <Button size="sm" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRows label="Loading model packs" rows={3} rowClassName="h-9 w-full" />
      ) : packs.length === 0 && !draft ? (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          No model packs available. Configure provider keys or add a custom pack.
        </Txt>
      ) : (
        <ul className="flex flex-col gap-1">
          {packs.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  {p.active && <Check size={13} className="text-accent1 shrink-0" />}
                  <Txt as="span" variant="ui-md" className="text-icon6 truncate">
                    {p.name}
                  </Txt>
                  {p.custom && <Badge size="sm">Custom</Badge>}
                  {p.active && (
                    <Badge size="sm" variant="success">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <ModelAssignment
                    icon={Hammer}
                    label="Build"
                    description="Implementation with full tool access"
                    model={p.models.build}
                  />
                  <ModelAssignment
                    icon={Map}
                    label="Plan"
                    description="Read-only analysis and planning"
                    model={p.models.plan}
                  />
                  <ModelAssignment
                    icon={Zap}
                    label="Fast"
                    description="Quick answers and small edits"
                    model={p.models.fast}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!p.active && (
                  <Button size="sm" disabled={busy || !resourceId} onClick={() => void activate(p.id)}>
                    Activate
                  </Button>
                )}
                {p.custom && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void remove(p.id)}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!draft && !loading && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })} disabled={busy}>
            <Plus size={13} /> New pack
          </Button>
        </div>
      )}
    </div>
  );
}
