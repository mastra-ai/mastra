import type { AgentVersionResponse } from '@mastra/client-js';
import { cleanProviderId } from '@mastra/playground-ui/domains/llm';
import type { RefObject } from 'react';

export type TargetType = 'agent' | 'workflow' | 'scorer';

export interface ExperimentTriggerInitialValues {
  initialDatasetId?: string;
  initialDatasetVersion?: number;
  initialScorerIds?: string[];
  initialTargetType?: TargetType;
  initialTargetId?: string;
  /** The agent version a rerun pinned, by id. Absent runs on the agent's latest version. */
  initialAgentVersion?: string;
  initialName?: string;
  initialDescription?: string;
}

export type AgentModel = { provider: string; modelId: string };
/** `defaultModel` is the model an agent target runs on unless the experiment picks another. */
export type TargetOption = { value: string; label: string; type: TargetType; id: string; defaultModel?: AgentModel };

export type ScorerOption = { value: string; label: string; description?: string };
export type DatasetOption = { value: string; label: string };

/** The dialog's popup, so the fields' lists open inside it. */
export type FieldPopupContainer = RefObject<HTMLDivElement | null>;

export const toTargetValue = (type: TargetType, id: string) => `${type}:${id}`;

/** Combobox `isItemEqualToValue`: Base UI passes `null` for an empty value. */
export const sameValue = <T extends { value: string }>(a: T | null, b: T | null) => a?.value === b?.value;

/**
 * The model a stored agent version runs on, for the dialog to show as the target's default.
 * The server applies a pinned version's config, so the model it was saved with is what the run uses.
 * Versions saved with a rules-based model resolve per request context on the server and have no single
 * model to show here, so they fall back to the target's own model.
 */
export const toVersionModel = (version?: AgentVersionResponse): AgentModel | undefined => {
  const model = version?.model;
  if (!model || Array.isArray(model) || !model.provider || !model.name) return undefined;
  return { provider: cleanProviderId(model.provider), modelId: model.name };
};
