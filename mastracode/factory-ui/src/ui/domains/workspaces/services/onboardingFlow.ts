/**
 * Session-scoped markers for the `/onboarding` wizard (`EmptyFactoryState`).
 * The draft and step survive full-page OAuth redirects
 * (GitHub/Linear) so the flow can resume where it left off. The
 * create-Factory wizard uses separate keys (`useCreateFactoryFlow`) so
 * the two flows never collide.
 *
 * Every write also stamps `updated-at`: resumability is time-bound so a stale
 * tab (or markers written by an older version of the flow) can never trap the
 * user in onboarding once a factory exists.
 */
import { z } from 'zod';
import { modelSetupPresetSchema } from './modelSetupPreset';

export const ONBOARDING_REVIEW_RETURN_KEY = 'mastracode.factory-onboarding.return-to-review';
export const ONBOARDING_DRAFT_KEY = 'mastracode.factory-onboarding.draft';
export const ONBOARDING_STEP_KEY = 'mastracode.factory-onboarding.step';
export const ONBOARDING_FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';
export const ONBOARDING_UPDATED_AT_KEY = 'mastracode.factory-onboarding.updated-at';

/**
 * How long a mid-flow marker stays resumable after the flow last progressed.
 * Generous for an OAuth consent screen (seconds to minutes), far too short
 * for an abandoned tab rediscovered hours later.
 */
export const ONBOARDING_RESUME_WINDOW_MS = 30 * 60 * 1000;

export type OnboardingStep =
  | 'initial'
  | 'vcs'
  | 'project-management'
  | 'model-preset'
  | 'model-provider'
  | 'personal-provider'
  | 'review';

const repositoryFields = {
  fullName: z.string(),
  name: z.string(),
  owner: z.string(),
  defaultBranch: z.string(),
  private: z.boolean(),
  sandboxProvider: z.string(),
  sandboxWorkdir: z.string(),
};
const connectionSchema = z.object({ providerId: z.string(), method: z.enum(['api_key', 'oauth']) });
const draftSchema = z.object({
  preset: modelSetupPresetSchema.optional(),
  repository: z
    .union([
      z.object({ ...repositoryFields, id: z.number(), installationId: z.number(), installationStorageId: z.string() }),
      z.object({
        ...repositoryFields,
        provider: z.literal('gitlab'),
        id: z.string(),
        externalId: z.string(),
        installationStorageId: z.string().optional(),
      }),
    ])
    .optional(),
  model: connectionSchema.extend({ modelId: z.string() }).optional(),
  personal: connectionSchema.extend({ modelId: z.string().optional() }).optional(),
});

export type OnboardingDraft = z.infer<typeof draftSchema>;
export type OnboardingModelChoice = NonNullable<OnboardingDraft['model']>;
export type OnboardingConnectionChoice = NonNullable<OnboardingDraft['personal']>;

/** Only non-secret choices survive redirects. Account credentials stay on the server. */
export function readOnboardingDraft(): OnboardingDraft {
  try {
    return draftSchema.parse(JSON.parse(sessionStorage.getItem(ONBOARDING_DRAFT_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function persistOnboardingDraft(draft: OnboardingDraft): void {
  sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draftSchema.parse(draft)));
  sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));
}

/** Persist the current step and refresh the resume window. */
export function persistOnboardingStep(step: OnboardingStep): void {
  sessionStorage.setItem(ONBOARDING_STEP_KEY, step);
  sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));
}

/** Persist the mid-flow factory id and refresh the resume window. */
export function persistOnboardingFactory(factoryId: string): void {
  sessionStorage.setItem(ONBOARDING_FACTORY_KEY, factoryId);
  sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));
}

/** Read the persisted step, defaulting to the beginning of the flow. */
export function readOnboardingStep(): OnboardingStep {
  const value = sessionStorage.getItem(ONBOARDING_STEP_KEY);
  return value === 'vcs' ||
    value === 'project-management' ||
    value === 'model-preset' ||
    value === 'model-provider' ||
    value === 'personal-provider' ||
    value === 'review'
    ? value
    : 'initial';
}

/** Drop every onboarding marker (flow finished or abandoned). */
export function clearOnboardingFlow(): void {
  sessionStorage.removeItem(ONBOARDING_REVIEW_RETURN_KEY);
  sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
  sessionStorage.removeItem(ONBOARDING_STEP_KEY);
  sessionStorage.removeItem(ONBOARDING_FACTORY_KEY);
  sessionStorage.removeItem(ONBOARDING_UPDATED_AT_KEY);
}

/**
 * Whether an onboarding flow is mid-way with its factory already created —
 * the only case where `/onboarding` may stay open (and `/` must route back
 * into it) even though a factory exists. A failed final confirmation can leave
 * a Factory to finish configuring. GitHub/Linear OAuth callbacks land on `/`, so
 * without this check the wizard would be abandoned at the factory home.
 *
 * Three gates, all required:
 * - a mid-flow step is stored (`vcs` / `project-management` / `model-provider` / `personal-provider` / `review`),
 * - the stored factory id exists in the server-backed list (a deleted
 *   factory never traps the user),
 * - the flow progressed within {@link ONBOARDING_RESUME_WINDOW_MS} (markers
 *   without a fresh timestamp — including ones written by older versions of
 *   the flow — are treated as abandoned).
 */
export function hasResumableFactoryOnboarding(factories: readonly { id: string }[]): boolean {
  const step = sessionStorage.getItem(ONBOARDING_STEP_KEY);
  if (
    step !== 'vcs' &&
    step !== 'project-management' &&
    step !== 'model-preset' &&
    step !== 'model-provider' &&
    step !== 'personal-provider' &&
    step !== 'review'
  )
    return false;

  const updatedAt = Number(sessionStorage.getItem(ONBOARDING_UPDATED_AT_KEY));
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > ONBOARDING_RESUME_WINDOW_MS) return false;

  const pendingFactoryId = sessionStorage.getItem(ONBOARDING_FACTORY_KEY);
  return pendingFactoryId !== null && factories.some(factory => factory.id === pendingFactoryId);
}
