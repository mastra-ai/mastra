import type { HarnessAvailableModel } from '@mastra/client-js';
import { useState } from 'react';

import type { OMConfigInfo } from '../../shared/api/types';
import {
  useOMQuery,
  useUpdateOMModel,
  useUpdateOMObserveAttachments,
  useUpdateOMThresholds,
} from '../../shared/hooks/use-om';

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

/**
 * Observational-memory settings. Mirrors the TUI's `/om` command: the observer
 * and reflector models, their token thresholds, and whether attachments are
 * observed. Everything is session-scoped (resolved from and written to the
 * active project's session), so it needs the project's resourceId.
 */
export function OMSection({ resourceId, models }: { resourceId?: string; models: HarnessAvailableModel[] }) {
  const omQuery = useOMQuery(resourceId);
  const observerMutation = useUpdateOMModel(resourceId, 'observer');
  const reflectorMutation = useUpdateOMModel(resourceId, 'reflector');
  const thresholdsMutation = useUpdateOMThresholds(resourceId);
  const attachmentsMutation = useUpdateOMObserveAttachments(resourceId);

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

  // Local threshold drafts so typing doesn't fire a request per keystroke. They
  // re-seed from the query's config during render whenever that config changes —
  // no effect needed (react-best-practices: derive-from-props, no useEffect
  // state reset).
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

  const modelOptions = models.map(m => m.id);

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <select
      className="pack-select"
      value={value}
      disabled={busy || !resourceId}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Select model…</option>
      {value && !modelOptions.includes(value) && <option value={value}>{value}</option>}
      {modelOptions.map(id => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );

  if (!resourceId) {
    return (
      <div className="providers-pane">
        <p className="provider-caption">
          Observational memory. Mirrors the TUI <code>/om</code> command.
        </p>
        <div className="provider-caption">Open a project to view and change its OM settings.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="providers-pane">
        <div className="provider-loading">Loading OM settings…</div>
      </div>
    );
  }

  const attachmentChoice: AttachmentChoice = config ? attachmentToChoice(config.observeAttachments) : 'auto';

  return (
    <div className="providers-pane">
      <p className="provider-caption">
        Observer and reflector models, their token thresholds, and attachment observation. Mirrors the TUI{' '}
        <code>/om</code> command.
      </p>
      {error && <div className="provider-error">{error}</div>}

      <div className="settings-field first">
        <div className="settings-field-label">
          <span>Observer model</span>
          <span className="settings-hint">Summarizes the conversation into observations</span>
        </div>
        {modelSelect(config?.observerModelId ?? '', v => switchModel('observer', v))}
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          <span>Reflector model</span>
          <span className="settings-hint">Distills observations into longer-term memory</span>
        </div>
        {modelSelect(config?.reflectorModelId ?? '', v => switchModel('reflector', v))}
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          <span>Observation threshold</span>
          <span className="settings-hint">Tokens in the message window before an observation fires</span>
        </div>
        <input
          className="provider-search-input om-threshold-input"
          type="number"
          min={1}
          step={1000}
          value={obsDraft}
          disabled={busy}
          onChange={e => setObsDraft(e.target.value)}
          onBlur={() => commitThreshold('observation')}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          <span>Reflection threshold</span>
          <span className="settings-hint">Accumulated observation tokens before a reflection fires</span>
        </div>
        <input
          className="provider-search-input om-threshold-input"
          type="number"
          min={1}
          step={1000}
          value={refDraft}
          disabled={busy}
          onChange={e => setRefDraft(e.target.value)}
          onBlur={() => commitThreshold('reflection')}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      <div className="settings-field">
        <div className="settings-field-label">
          <span>Observe attachments</span>
          <span className="settings-hint">Whether attached files are fed to the observer</span>
        </div>
        <div className="seg" role="group" aria-label="Observe attachments">
          {(['auto', 'on', 'off'] as AttachmentChoice[]).map(choice => (
            <button
              key={choice}
              className={`seg-btn ${attachmentChoice === choice ? 'active' : ''}`}
              aria-pressed={attachmentChoice === choice}
              disabled={busy}
              onClick={() => {
                setLocalError(null);
                attachmentsMutation.mutate({ value: choiceToAttachment(choice) });
              }}
            >
              {choice === 'auto' ? 'Auto' : choice === 'on' ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
