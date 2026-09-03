import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../api/keys';
import type { FactoryProject, FactoryProjectPayload, GithubRepo } from '../services/github';

// Separate sessionStorage keys from onboarding so the two flows never collide.
const STEP_KEY = 'mastracode.factory-create.step';
const NAME_KEY = 'mastracode.factory-create.name';
const REPO_KEY = 'mastracode.factory-create.repository';
const LINEAR_PROJECT_KEY = 'mastracode.factory-create.linear-project-id';
const FACTORY_KEY = 'mastracode.factory-create.factory-id';
const LINKED_KEY = 'mastracode.factory-create.linked-repository-id';
const HOST_KEY = 'mastracode.factory-create.host-factory-id';

export const CREATE_FACTORY_STEPS = ['name', 'vcs', 'project-management', 'model-provider'] as const;

export type CreateFactoryFlowStep = (typeof CREATE_FACTORY_STEPS)[number];

function isResumableStep(value: string | null): value is Exclude<CreateFactoryFlowStep, 'name'> {
  return value !== null && value !== 'name' && CREATE_FACTORY_STEPS.some(step => step === value);
}

/** A stored step is only honoured while the picks it was reached through are still there. */
function canResume(step: Exclude<CreateFactoryFlowStep, 'name'>, draft: Omit<CreateFactoryDraft, 'step'>): boolean {
  return step === 'vcs' ? Boolean(draft.name) : Boolean(draft.name && draft.repository);
}

function isGithubRepo(value: unknown): value is GithubRepo {
  if (typeof value !== 'object' || value === null) return false;
  const candidate: Partial<Record<keyof GithubRepo, unknown>> = value;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.defaultBranch === 'string' &&
    typeof candidate.installationStorageId === 'string'
  );
}

function readRepository(): GithubRepo | undefined {
  const stored = sessionStorage.getItem(REPO_KEY);
  if (!stored) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = undefined;
  }
  if (isGithubRepo(parsed)) return parsed;

  sessionStorage.removeItem(REPO_KEY);
  return undefined;
}

/**
 * The wizard's draft. Everything the user picked lives here until the last
 * step commits it, so quitting halfway leaves no half-built Factory behind.
 * `factoryId` and `linkedRepositoryId` only appear once that commit starts —
 * they let a failed attempt resume instead of creating a second Factory.
 */
export interface CreateFactoryDraft {
  step: CreateFactoryFlowStep;
  name?: string;
  repository?: GithubRepo;
  /** The Linear project whose issues feed the new board, when the user picked one. */
  linearProjectId?: string;
  factoryId?: string;
  linkedRepositoryId?: string;
  /** The Factory whose shell hosts the wizard, so an OAuth return comes back to it. */
  hostFactoryId?: string;
}

function readDraft(): CreateFactoryDraft {
  const picks = {
    name: sessionStorage.getItem(NAME_KEY) ?? undefined,
    repository: readRepository(),
    linearProjectId: sessionStorage.getItem(LINEAR_PROJECT_KEY) ?? undefined,
    factoryId: sessionStorage.getItem(FACTORY_KEY) ?? undefined,
    linkedRepositoryId: sessionStorage.getItem(LINKED_KEY) ?? undefined,
    hostFactoryId: sessionStorage.getItem(HOST_KEY) ?? undefined,
  };
  const step = sessionStorage.getItem(STEP_KEY);
  if (!isResumableStep(step) || !canResume(step, picks))
    return { step: 'name', name: picks.name, hostFactoryId: picks.hostFactoryId };
  return { ...picks, step };
}

function writeDraft({
  step,
  name,
  repository,
  linearProjectId,
  factoryId,
  linkedRepositoryId,
  hostFactoryId,
}: CreateFactoryDraft): void {
  sessionStorage.setItem(STEP_KEY, step);
  writeEntry(NAME_KEY, name);
  writeEntry(REPO_KEY, repository && JSON.stringify(repository));
  writeEntry(LINEAR_PROJECT_KEY, linearProjectId);
  writeEntry(FACTORY_KEY, factoryId);
  writeEntry(LINKED_KEY, linkedRepositoryId);
  writeEntry(HOST_KEY, hostFactoryId);
}

function writeEntry(key: string, value: string | undefined): void {
  if (value) sessionStorage.setItem(key, value);
  else sessionStorage.removeItem(key);
}

function clearDraft(): void {
  for (const key of [STEP_KEY, NAME_KEY, REPO_KEY, LINEAR_PROJECT_KEY, FACTORY_KEY, LINKED_KEY, HOST_KEY])
    sessionStorage.removeItem(key);
}

/**
 * The Factory whose wizard an OAuth callback must return to, read straight from
 * sessionStorage so `RootLanding` can redirect before any query resolves. Only
 * steps past `name` count — merely visiting the page is not a pending flow.
 */
export function pendingCreateFlowFactoryId(): string | undefined {
  if (!isResumableStep(sessionStorage.getItem(STEP_KEY))) return undefined;
  return sessionStorage.getItem(HOST_KEY) ?? undefined;
}

/**
 * State machine for the create-Factory wizard (Name → VCS → Project
 * management → Model provider). The draft lives in sessionStorage so a
 * full-page OAuth redirect (GitHub/Linear) resumes where it left off.
 */
export function useCreateFactoryFlow() {
  const queryClient = useQueryClient();
  const patchDraft = useMutation({
    mutationFn: async (patch: Partial<CreateFactoryDraft>) => writeDraft({ ...readDraft(), ...patch }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factoryCreateFlow() }),
  });
  const draftQuery = useQuery({
    queryKey: queryKeys.factoryCreateFlow(),
    queryFn: readDraft,
  });

  const clear = useMutation({
    mutationFn: async () => clearDraft(),
    onSuccess: () => queryClient.setQueryData(queryKeys.factoryCreateFlow(), { step: 'name' }),
  });

  const step = draftQuery.data?.step ?? 'name';

  return {
    draft: draftQuery.data,
    startVcs: (name: string) => patchDraft.mutateAsync({ step: 'vcs', name }),
    chooseRepository: (repository: GithubRepo) => patchDraft.mutateAsync({ step: 'project-management', repository }),
    chooseLinearProject: (linearProjectId: string) =>
      patchDraft.mutateAsync({ step: 'model-provider', linearProjectId }),
    skipLinear: () => patchDraft.mutateAsync({ step: 'model-provider', linearProjectId: undefined }),
    /** Keep what the final commit already achieved, so a retry resumes instead of duplicating. */
    rememberFactory: (factory: FactoryProject | FactoryProjectPayload) =>
      patchDraft.mutateAsync({ factoryId: factory.id }),
    rememberLinkedRepository: (linkedRepositoryId: string) => patchDraft.mutateAsync({ linkedRepositoryId }),
    back: () =>
      patchDraft.mutateAsync({ step: CREATE_FACTORY_STEPS[CREATE_FACTORY_STEPS.indexOf(step) - 1] ?? 'name' }),
    /** Re-persist the current draft, with its host, right before a full-page OAuth redirect. */
    persistBeforeRedirect: (hostFactoryId: string | undefined) => writeDraft({ ...readDraft(), hostFactoryId }),
    clear: clear.mutateAsync,
  };
}
