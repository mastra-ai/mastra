import { Button } from '@mastra/playground-ui/components/Button';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAddFactoryMutation } from '../../../../shared/hooks/useFactories';
import { useGithubStatusQuery } from '../../../../shared/hooks/useGithubStatus';
import { DirectoryBrowser } from '../workspaces/components/DirectoryPicker';
import { GithubConnectModal } from '../workspaces/components/GithubConnectModal';
import type { Factory } from '../workspaces';
import { projectEntry } from '../../lib/projectRoutes';

type OnboardingStep = 'dashboard' | 'local';

export function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('dashboard');
  const navigate = useNavigate();
  const github = useGithubStatusQuery();
  const addLocalFactory = useAddFactoryMutation();

  const finish = (factory: Factory) => {
    localStorage.setItem('mastracode-active-factory', factory.id);
    void navigate(projectEntry(factory), { replace: true });
  };

  const createLocal = async (path: string, name: string) => {
    try {
      finish(await addLocalFactory.mutateAsync({ name: name || path, path }));
    } catch {
      // Mutation state renders the error.
    }
  };

  if (step === 'local') {
    const error = addLocalFactory.error instanceof Error ? addLocalFactory.error.message : undefined;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 p-6">
        <h1 className="text-ui-xl font-semibold text-icon6">Set up a local project</h1>
        <DirectoryBrowser onPick={(path, name) => void createLocal(path, name)} onCancel={() => setStep('dashboard')} busy={addLocalFactory.isPending} error={error} />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface1 p-6">
      {github.data ? (
        <GithubConnectModal status={github.data} onFactoryCreated={finish} onClose={() => undefined} />
      ) : null}
      <div className="fixed bottom-6 z-[60]">
        <Button variant="outline" onClick={() => setStep('local')}>Skip and setup local project</Button>
      </div>
    </main>
  );
}
