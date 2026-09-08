import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { CreateFactoryWizard } from '../domains/workspaces/components/create-factory/CreateFactoryWizard';

/** Inline wizard: the sidebar stays; onboarding owns the full-screen first-run variant. */
export function CreateFactoryPage() {
  return <FactoryPageShell>{() => <CreateFactoryWizard />}</FactoryPageShell>;
}
