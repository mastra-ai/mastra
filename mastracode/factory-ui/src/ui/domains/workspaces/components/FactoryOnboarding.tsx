import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useEffect, useRef, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import { useCompleteFactorySetup } from '../hooks/useCompleteFactorySetup';
import type { OnboardingModelLane } from '../hooks/useOnboardingModelLane';
import { useOnboardingModelSetup } from '../hooks/useOnboardingModelSetup';
import type { ProviderConnectionMethod } from '../hooks/useProviderConnection';
import type { WorkSource } from '../hooks/useWorkSourceConnections';
import type { SourceControlRepository } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';
import {
  persistOnboardingDraft,
  persistOnboardingStep,
  readOnboardingDraft,
  readOnboardingStep,
} from '../services/onboardingFlow';
import type { OnboardingDraft, OnboardingStep } from '../services/onboardingFlow';
import { nextOnboardingStep, restoredOnboardingStep } from '../services/onboardingSteps';
import type { GitHubAppCallbackResult } from './GitHubAppCallbackHandler';
import { OnboardingAccountMenu } from './onboarding/OnboardingAccountMenu';
import { OnboardingAccountsRow } from './onboarding/OnboardingAccountsRow';
import { OnboardingCodebaseRow } from './onboarding/OnboardingCodebaseRow';
import { OnboardingModelRow } from './onboarding/OnboardingModelRow';
import { OnboardingModelSection } from './onboarding/OnboardingModelSection';
import { OnboardingSlot } from './onboarding/OnboardingSlot';
import type { OnboardingModelPreview } from './onboarding/OnboardingModelSection';
import { OnboardingWorkRow } from './onboarding/OnboardingWorkRow';
import { OnboardingPreview } from './onboarding/preview/OnboardingPreview';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';
import { VcsFactoryStep } from './VcsFactoryStep';
import './onboarding/onboarding.css';

interface SectionPreview extends OnboardingModelPreview {
  repository?: SourceControlRepository;
}

interface LanePreview {
  providerId?: string;
  method?: ProviderConnectionMethod;
  model?: string;
}

/**
 * A provider being previewed in the picker replaces the connected one, and hides its model until it connects.
 * Previewing the lane's own provider shows its chosen model, the one Create submits.
 */
function lanePreview(lane: OnboardingModelLane, providerId?: string, method?: ProviderConnectionMethod): LanePreview {
  const shownMethod = method ?? lane.connection.method;
  if (providerId && providerId !== lane.connectedProvider?.provider) return { providerId, method: shownMethod };
  return { providerId: lane.connectedProvider?.provider, method: shownMethod, model: lane.modelId };
}

export interface FactoryOnboardingProps {
  local: boolean;
  githubCallback?: GitHubAppCallbackResult;
  onDismissGithubCallback: () => void;
}

/**
 * One page with the Codebase, Work and Model steps; one is open, the others summarise or preview. The
 * Model step opens as two cards, Accounts and Model.
 */
export function FactoryOnboarding({ local, githubCallback, onDismissGithubCallback }: FactoryOnboardingProps) {
  const { baseUrl } = useApiConfig();
  const complete = useCompleteFactorySetup({ local });
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const saved = readOnboardingDraft();
    return local ? { ...saved, modelScope: 'factory' } : saved;
  });
  const [openStep, setOpenStep] = useState<OnboardingStep>(() => restoredOnboardingStep(readOnboardingStep(), draft));
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const [previewSource, setPreviewSource] = useState<WorkSource>();
  const [preview, setPreview] = useState<SectionPreview>({});
  const showVisual = !useIsMobile(900);
  const mainRef = useRef<HTMLElement>(null);
  const focusOpenedSection = useRef(false);

  // Continue, Skip and Change unmount with their section, so focus moves to the section that opened.
  // Only the open section has an h2.
  useEffect(() => {
    if (!focusOpenedSection.current) return;
    focusOpenedSection.current = false;
    mainRef.current?.querySelector('h2')?.focus();
  }, [openStep]);

  // Back from GitHub restores this page from the bfcache with the spinner still on; Connect must work again.
  useEffect(() => {
    const resetRedirect = (event: PageTransitionEvent) => {
      if (event.persisted) setGithubRedirecting(false);
    };
    window.addEventListener('pageshow', resetRedirect);
    return () => window.removeEventListener('pageshow', resetRedirect);
  }, []);

  // A ref, not a functional update: a gateway connect reports after an await and must merge into the
  // latest draft, and the storage write has to stay out of the state updater.
  const latestDraft = useRef(draft);
  const updateDraft = (patch: Partial<OnboardingDraft>) => {
    // The create failure was about the old choices; a change means the user is acting on it.
    if (complete.isError) complete.reset();
    const next = { ...latestDraft.current, ...patch };
    latestDraft.current = next;
    persistOnboardingDraft(next);
    setDraft(next);
  };
  const open = (step: OnboardingStep) => {
    persistOnboardingStep(step);
    focusOpenedSection.current = true;
    setOpenStep(step);
    setPreview({});
    complete.reset();
  };
  const finish = (patch: Partial<OnboardingDraft>) => {
    updateDraft(patch);
    open(nextOnboardingStep(latestDraft.current));
  };
  const setup = useOnboardingModelSetup({ draft, local, onDraftChange: updateDraft });
  const change = (step: OnboardingStep) => ({ onChange: () => open(step), changeDisabled: complete.isPending });

  const connectGithubFromOnboarding = () => {
    onDismissGithubCallback();
    setGithubRedirecting(true);
    persistOnboardingStep('vcs');
    connectGithub(baseUrl);
  };
  const manageGithubFromOnboarding = () => {
    persistOnboardingStep('vcs');
    manageGithubConnection(baseUrl);
  };
  const connectLinearFromOnboarding = () => {
    persistOnboardingStep('project-management');
    connectLinear(baseUrl);
  };
  const createFactory = () => {
    if (complete.isPending) return;
    updateDraft({
      modelScope: setup.scope,
      model: setup.company.choice ?? draft.model,
      personal: setup.personal.choice ?? draft.personal,
    });
    complete.mutate(setup.draft);
  };
  const companyPreview = lanePreview(setup.company, preview.providerId, preview.method);
  const personalPreview = lanePreview(setup.personal, preview.personalProviderId, preview.personalMethod);

  return (
    <div className="bg-background text-foreground min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <LogoWithoutText className="w-6" aria-hidden="true" />
            <Txt as="span" variant="label">
              Factory
            </Txt>
          </div>
          <OnboardingAccountMenu />
        </header>
        <main
          ref={mainRef}
          className="mx-auto flex w-full max-w-[520px] flex-col gap-2 px-4 pt-6 pb-6 min-[900px]:px-5"
        >
          <Txt as="h1" variant="display" className="mb-4">
            Set up your factory
          </Txt>
          <OnboardingSlot>
            {openStep === 'vcs' ? (
              <VcsFactoryStep
                initialRepository={draft.repository}
                githubRedirecting={githubRedirecting}
                githubCallback={githubCallback}
                onDismissGithubCallback={onDismissGithubCallback}
                onConnect={connectGithubFromOnboarding}
                onManageConnection={manageGithubFromOnboarding}
                onPreviewRepository={repository => setPreview(current => ({ ...current, repository }))}
                onSelectRepository={repository => {
                  // The GitHub result has served its purpose; kept, it would reopen Change on GitHub over a GitLab pick.
                  onDismissGithubCallback();
                  finish({ repository });
                }}
              />
            ) : (
              <OnboardingCodebaseRow repository={draft.repository} {...change('vcs')} />
            )}
          </OnboardingSlot>
          <OnboardingSlot>
            {openStep === 'project-management' ? (
              <ProjectManagementFactoryStep
                onPreviewSource={setPreviewSource}
                onConnect={connectLinearFromOnboarding}
                onContinue={() => finish({ workConfirmed: true })}
              />
            ) : (
              <OnboardingWorkRow confirmed={draft.workConfirmed === true} {...change('project-management')} />
            )}
          </OnboardingSlot>
          <OnboardingSlot>
            {openStep === 'model' ? (
              <OnboardingModelSection
                setup={setup}
                local={local}
                creating={complete.isPending}
                error={complete.error?.message}
                onScopeChange={modelScope => updateDraft({ modelScope })}
                onPreview={patch => setPreview(current => ({ ...current, ...patch }))}
                onCreate={createFactory}
              />
            ) : (
              <>
                {!local && <OnboardingAccountsRow setup={setup} {...change('model')} />}
                <OnboardingModelRow setup={setup} local={local} {...change('model')} />
              </>
            )}
          </OnboardingSlot>
        </main>
        <Txt as="p" variant="meta" tone="muted" className="mt-auto px-6 pt-2 pb-32 min-[900px]:pb-5">
          You can change your codebase, work sources and model anytime in Settings.
        </Txt>
      </div>
      {/* The page scrolls the form; the preview stays pinned to the viewport beside it, like ChatGPT's main pane. */}
      {showVisual && (
        <div className="sticky top-0 h-dvh p-2">
          <div className="onboarding-card bg-card rounded-studio-frame h-full overflow-hidden p-px">
            <OnboardingPreview
              step={openStep}
              modelScope={setup.scope}
              local={local}
              repository={preview.repository ?? draft.repository}
              source={previewSource}
              providerId={companyPreview.providerId}
              connectionMethod={companyPreview.method}
              model={companyPreview.model}
              personalProviderId={personalPreview.providerId}
              personalConnectionMethod={personalPreview.method}
              personalModel={personalPreview.model}
            />
          </div>
        </div>
      )}
    </div>
  );
}
