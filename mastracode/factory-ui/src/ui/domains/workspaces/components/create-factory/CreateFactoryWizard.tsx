import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../../api/config';
import { useGithubReposQuery } from '../../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../../hooks/useGithubStatus';
import { connectLinear } from '../../../factory/services/linear';
import { useCreateFactoryFlow, type CreateFactoryFlowStep } from '../../hooks/useCreateFactoryFlow';
import { useCreateFactoryFromDraft } from '../../hooks/useCreateFactoryFromDraft';
import { factoryHomePath } from '../../services/factoryPaths';
import { connectGithub, manageGithubConnection } from '../../services/github';
import { useKeyDown } from '../../../../lib/hooks';
import { CreateFactoryLinearRows } from './CreateFactoryLinearRows';
import { CreateFactoryModelStep } from './CreateFactoryModelStep';
import { CreateFactoryNameRows } from './CreateFactoryNameRows';
import { CreateFactoryPalette } from './CreateFactoryPalette';
import { CreateFactoryRepositoryRows } from './CreateFactoryRepositoryRows';

interface StepChrome {
  title: string;
  placeholder: string;
  searchLabel: string;
  searchable?: boolean;
}

const STEP_CHROME: Record<CreateFactoryFlowStep, StepChrome> = {
  name: {
    title: 'Name your new Factory',
    placeholder: 'e.g. Mastra',
    searchLabel: 'Factory name',
    searchable: false,
  },
  vcs: {
    title: 'Choose your codebase',
    placeholder: 'Search repositories…',
    searchLabel: 'Search repositories',
  },
  'project-management': {
    title: 'Connect the work behind the code',
    placeholder: 'Search options…',
    searchLabel: 'Search project management options',
  },
  'model-provider': {
    title: 'Choose your Factory model',
    placeholder: 'Search models and providers…',
    searchLabel: 'Search models and providers',
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/**
 * Name → VCS → Project management → Model provider. Every pick stays in the
 * draft until the model step commits it, so the Factory only exists once the
 * user finished the wizard.
 */
export function CreateFactoryWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const flow = useCreateFactoryFlow();
  const [githubRedirecting, setGithubRedirecting] = useState(false);
  const [typed, setTyped] = useState<{ step: CreateFactoryFlowStep; value: string }>();

  const draft = flow.draft;
  // The repository list loads while the name is still being typed, so the next step has rows on arrival.
  const githubStatus = useGithubStatusQuery();
  useGithubReposQuery(undefined, draft?.step === 'name' && githubStatus.data?.connected === true);

  const createFactory = useCreateFactoryFromDraft({
    draft,
    onFactoryCreated: factory => flow.rememberFactory(factory),
    onRepositoryLinked: linkedRepositoryId => flow.rememberLinkedRepository(linkedRepositoryId),
    onCreated: async factory => {
      await flow.clear();
      void navigate(factoryHomePath(factory));
    },
  });

  const leave = () => {
    if (location.key === 'default') void navigate(factoryId ? `/factories/${factoryId}` : '/');
    else void navigate(-1);
  };
  useKeyDown({ escape: leave });

  const step = draft?.step;
  if (!step) return null;

  // Each step starts from its own field value — the name step from the name already given.
  const value = typed?.step === step ? typed.value : step === 'name' ? (draft.name ?? '') : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <CreateFactoryPalette
        {...STEP_CHROME[step]}
        step={step}
        value={value}
        onValueChange={nextValue => setTyped({ step, value: nextValue })}
        onBack={step === 'name' ? leave : () => void flow.back()}
        onSkip={step === 'project-management' ? () => void flow.skipLinear() : undefined}
      >
        {step === 'name' && <CreateFactoryNameRows name={value} onSubmit={flow.startVcs} />}
        {step === 'vcs' && (
          <CreateFactoryRepositoryRows
            query={value}
            githubRedirecting={githubRedirecting}
            onConnect={() => {
              setGithubRedirecting(true);
              flow.persistBeforeRedirect();
              connectGithub(baseUrl);
            }}
            onManageConnection={() => {
              flow.persistBeforeRedirect();
              manageGithubConnection(baseUrl);
            }}
            onSelectRepository={repository => void flow.chooseRepository(repository)}
          />
        )}
        {step === 'project-management' && (
          <CreateFactoryLinearRows
            query={value}
            onConnect={() => {
              flow.persistBeforeRedirect();
              connectLinear(baseUrl);
            }}
            onSelectProject={projectId => void flow.chooseLinearProject(projectId)}
            onSkip={() => void flow.skipLinear()}
          />
        )}
        {step === 'model-provider' && (
          <CreateFactoryModelStep
            query={value}
            savingModelId={createFactory.isPending ? createFactory.variables?.modelId : undefined}
            error={createFactory.error ? errorMessage(createFactory.error) : undefined}
            onPick={(providerId, modelId) => createFactory.mutate({ providerId, modelId })}
          />
        )}
      </CreateFactoryPalette>
    </div>
  );
}
