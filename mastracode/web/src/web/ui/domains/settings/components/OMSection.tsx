import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { OMConfigInfo } from '../../../../../shared/api/types';
import {
  useOMQuery,
  useUpdateOMModel,
  useUpdateOMObserveAttachments,
  useUpdateOMThresholds,
} from '../../../../../shared/hooks/use-om';
import type { AvailableModelOption } from '../../../../../shared/hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from './ModelCombobox';

type OMConfig = OMConfigInfo;

type AttachmentChoice = 'auto' | 'on' | 'off';

function attachmentToChoice(value: 'auto' | boolean): AttachmentChoice {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return 'auto';
}

function choiceToAttachment(choice: AttachmentChoice): 'auto' | boolean {
  if (choice === 'on') return true;
  if (choice === 'off') return false;
  return 'auto';
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col">
        <Txt as="span" variant="ui-sm" className="text-icon5">
          {label}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          {hint}
        </Txt>
      </div>
      {children}
    </div>
  );
}

/**
 * Observational-memory settings. Mirrors the TUI's `/om` command: the observer
 * and reflector models, their token thresholds, and whether attachments are
 * observed. Everything is session-scoped (resolved from and written to the
 * active factory's session), so it needs the project's resourceId.
 */
export function OMSection({
  resourceId,
  scope,
  models,
}: {
  resourceId?: string;
  scope?: string;
  models: AvailableModelOption[];
}) {
  const omQuery = useOMQuery(resourceId, scope);
  const observerMutation = useUpdateOMModel(resourceId, 'observer', scope);
  const reflectorMutation = useUpdateOMModel(resourceId, 'reflector', scope);
  const thresholdsMutation = useUpdateOMThresholds(resourceId, scope);
  const attachmentsMutation = useUpdateOMObserveAttachments(resourceId, scope);

  const config = omQuery.data?.config ?? null;
  const loading = omQuery.isPending && !!resourceId;
  const busy =
    observerMutation.isPending ||
    reflectorMutation.isPending ||
    thresholdsMutation.isPending ||
    attachmentsMutation.isPending;

  const mutationError =
    (observerMutation.error ??
      reflectorMutation.error ??
      thresholdsMutation.error ??
      attachmentsMutation.error) instanceof Error
      ? (observerMutation.error ?? reflectorMutation.error ?? thresholdsMutation.error ?? attachmentsMutation.error)!
          .message
      : null;
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? mutationError ?? (omQuery.error instanceof Error ? omQuery.error.message : null);

  const [obsDraft, setObsDraft] = useState('');
  const [refDraft, setRefDraft] = useState('');
  const [seededFrom, setSeededFrom] = useState<OMConfig | null>(null);
  if (config && config !== seededFrom) {
    setSeededFrom(config);
    setObsDraft(String(config.observationThreshold));
    setRefDraft(String(config.reflectionThreshold));
  }

  const switchModel = (role: 'observer' | 'reflector', modelId: string) => {
    if (!modelId) return;
    setLocalError(null);
    const mutation = role === 'observer' ? observerMutation : reflectorMutation;
    mutation.mutate({ modelId });
  };

  const commitThreshold = (role: 'observation' | 'reflection') => {
    if (!config) return;
    const draft = role === 'observation' ? obsDraft : refDraft;
    const parsed = Number(draft);
    const current = role === 'observation' ? config.observationThreshold : config.reflectionThreshold;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      // Reset the field to the persisted value on invalid input.
      if (role === 'observation') setObsDraft(String(config.observationThreshold));
      else setRefDraft(String(config.reflectionThreshold));
      return;
    }
    if (Math.round(parsed) === current) return;
    setLocalError(null);
    thresholdsMutation.mutate({ [`${role}Threshold`]: Math.round(parsed) });
  };

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <ModelCombobox models={models} value={value} disabled={busy || !resourceId} onValueChange={onChange} />
  );

  if (!resourceId) {
    return (
      <div className="flex flex-col gap-3">
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Observational memory. Mirrors the TUI <code>/om</code> command.
        </Txt>
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Open a factory to view and change its OM settings.
        </Txt>
      </div>
    );
  }

  if (loading) {
    return <SkeletonRows label="Loading OM settings" rows={4} rowClassName="h-10 w-full" />;
  }

  const attachmentChoice: AttachmentChoice = config ? attachmentToChoice(config.observeAttachments) : 'auto';
  const attachmentOptions: { value: AttachmentChoice; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Txt as="p" variant="ui-sm" className="text-icon3">
        Observer and reflector models, their token settings, and attachment observation. Mirrors the TUI{' '}
        <code>/memory</code> command.
      </Txt>
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      <Field label="Observer model" hint="Summarizes the conversation into observations">
        {modelSelect(config?.observerModelId ?? '', v => switchModel('observer', v))}
      </Field>

      <Field label="Reflector model" hint="Distills observations into longer-term memory">
        {modelSelect(config?.reflectorModelId ?? '', v => switchModel('reflector', v))}
      </Field>

      <Field
        label="Messages before observation"
        hint="Message tokens before the Observer runs. More means a larger message window per observation."
      >
        <Input
          size="sm"
          type="number"
          min={1}
          step={1000}
          value={obsDraft}
          disabled={busy}
          onChange={e => setObsDraft(e.target.value)}
          onBlur={() => commitThreshold('observation')}
        />
      </Field>

      <Field
        label="Observations before reflection"
        hint="Accumulated observation tokens before the Reflector compresses them. More means less frequent compression."
      >
        <Input
          size="sm"
          type="number"
          min={1}
          step={1000}
          value={refDraft}
          disabled={busy}
          onChange={e => setRefDraft(e.target.value)}
          onBlur={() => commitThreshold('reflection')}
        />
      </Field>

      <Field label="Observe attachments" hint="Whether attached files are fed to the observer">
        <ButtonsGroup spacing="close" role="group" aria-label="Observe attachments">
          {attachmentOptions.map(o => (
            <Button
              key={o.value}
              variant={attachmentChoice === o.value ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={attachmentChoice === o.value}
              disabled={busy}
              onClick={() => {
                setLocalError(null);
                attachmentsMutation.mutate({ value: choiceToAttachment(o.value) });
              }}
            >
              {o.label}
            </Button>
          ))}
        </ButtonsGroup>
      </Field>
    </div>
  );
}
