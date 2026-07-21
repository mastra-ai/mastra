import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAddFactoryMutation, useCreateFactoryMutation } from '../../../../shared/hooks/useFactories';
import { projectEntry } from '../../lib/projectRoutes';
import type { Factory } from '../workspaces';
import { DirectoryBrowser } from '../workspaces/components/DirectoryPicker';

type OnboardingStep = 'dashboard' | 'local';

export function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('dashboard');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const createFactory = useCreateFactoryMutation();
  const addLocalFactory = useAddFactoryMutation();

  const finish = (factory: Factory) => {
    void navigate(projectEntry(factory), { replace: true });
  };

  const createDashboard = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      finish(await createFactory.mutateAsync({ name: trimmed }));
    } catch {
      // Mutation state renders the error.
    }
  };

  const createLocal = async (path: string, folderName: string) => {
    try {
      finish(await addLocalFactory.mutateAsync({ name: folderName || path, path }));
    } catch {
      // Mutation state renders the error.
    }
  };

  if (step === 'local') {
    const error = addLocalFactory.error instanceof Error ? addLocalFactory.error.message : undefined;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 p-6">
        <h1 className="text-ui-xl font-semibold text-icon6">Set up a local project</h1>
        <DirectoryBrowser
          onPick={(path, folderName) => void createLocal(path, folderName)}
          onCancel={() => setStep('dashboard')}
          busy={addLocalFactory.isPending}
          error={error}
        />
      </main>
    );
  }

  const error = createFactory.error instanceof Error ? createFactory.error.message : undefined;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface1 p-6">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border1 bg-surface2 p-6">
        <div>
          <h1 className="text-ui-xl font-semibold text-icon6">Create your Factory</h1>
          <p className="mt-1 text-ui-sm text-icon3">Name your Factory, then connect repositories from its dashboard.</p>
        </div>
        <Input aria-label="Factory name" value={name} onChange={event => setName(event.target.value)} placeholder="Factory name" />
        {error && <Notice variant="destructive">{error}</Notice>}
        <Button disabled={!name.trim() || createFactory.isPending} onClick={() => void createDashboard()}>
          {createFactory.isPending ? 'Creating…' : 'Create Factory'}
        </Button>
        <Button variant="outline" onClick={() => setStep('local')}>Skip and setup local project</Button>
      </section>
    </main>
  );
}
