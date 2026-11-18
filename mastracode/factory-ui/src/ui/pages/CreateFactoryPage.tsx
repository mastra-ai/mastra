import { CreateFactoryPageFrame } from '../domains/workspaces/components/create-factory/CreateFactoryPageFrame';
import { CreateFactoryWizard } from '../domains/workspaces/components/create-factory/CreateFactoryWizard';

/** Inline wizard: the sidebar stays; onboarding owns the full-screen first-run variant. */
export function CreateFactoryPage() {
  return (
    <CreateFactoryPageFrame>
      <CreateFactoryWizard />
    </CreateFactoryPageFrame>
  );
}
