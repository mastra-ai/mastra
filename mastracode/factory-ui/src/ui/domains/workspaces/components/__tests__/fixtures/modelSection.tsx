import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import type { BoundFunctions, queries } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/ui/render';
import { useOnboardingModelSetup } from '../../../hooks/useOnboardingModelSetup';
import type { GithubRepo } from '../../../services/github';
import type { OnboardingDraft } from '../../../services/onboardingFlow';
import { OnboardingModelSection } from '../../onboarding/OnboardingModelSection';

export const modelSectionRepository: GithubRepo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

function ModelSectionHarness({
  initialDraft,
  local,
  onCreate,
}: {
  initialDraft: OnboardingDraft;
  local: boolean;
  onCreate: Mock<(draft: OnboardingDraft) => void>;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const setup = useOnboardingModelSetup({
    draft,
    local,
    onDraftChange: patch => setDraft(current => ({ ...current, ...patch })),
  });
  return (
    <OnboardingModelSection
      setup={setup}
      local={local}
      creating={false}
      onScopeChange={modelScope => setDraft(current => ({ ...current, modelScope }))}
      onCreate={() => onCreate(setup.draft)}
      onPreview={() => {}}
    />
  );
}

/** Renders the Model section over real hooks; `onCreate` receives the draft Create would submit. */
export function renderModelSection({ draft = {}, local = false }: { draft?: OnboardingDraft; local?: boolean } = {}) {
  const onCreate = vi.fn<(draft: OnboardingDraft) => void>();
  const view = renderWithProviders(
    <ModelSectionHarness
      initialDraft={{ repository: modelSectionRepository, ...draft }}
      local={local}
      onCreate={onCreate}
    />,
  );
  return { ...view, onCreate };
}

/**
 * Opens a lane's provider list. Pass `lane` when several lanes are on screen. The options render in a
 * popover outside the lane, so query them on `screen`.
 */
export async function openProviderList(user: UserEvent, lane: BoundFunctions<typeof queries> = screen) {
  await user.click(await lane.findByRole('button', { name: /^(Provider: |Choose a provider$)/ }));
  await screen.findByRole('searchbox', { name: 'Search model providers' });
}

/** Opens a lane's provider list, picks the option named `option` and waits for the list to close. */
export async function chooseProvider(user: UserEvent, option: string, lane?: BoundFunctions<typeof queries>) {
  await openProviderList(user, lane);
  await pickOpenOption(user, option);
}

/** Like `chooseProvider`, for a provider you sign in to: switches the list to subscriptions first. */
export async function chooseSubscription(user: UserEvent, option: string, lane?: BoundFunctions<typeof queries>) {
  await openProviderList(user, lane);
  await user.click(screen.getByRole('radio', { name: 'Subscription' }));
  await pickOpenOption(user, option);
}

async function pickOpenOption(user: UserEvent, option: string) {
  const search = screen.getByRole('searchbox', { name: 'Search model providers' });
  await user.click(screen.getByRole('button', { name: option }));
  if (search.isConnected) await waitForElementToBeRemoved(search);
}
