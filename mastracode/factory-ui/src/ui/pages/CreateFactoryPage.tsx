import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { CreateFactoryWizard } from '../domains/workspaces/components/create-factory/CreateFactoryWizard';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { HrefLink } from '../ui/HrefLink';

/** Inline wizard: the sidebar stays; onboarding owns the full-screen first-run variant. */
export function CreateFactoryPage() {
  const factory = useActiveFactory();
  return (
    <PageLayout
      variant="form"
      backHref={`/factories/${factory.id}`}
      backLabel={factory.name}
      title="New Factory"
      LinkComponent={HrefLink}
    >
      <CreateFactoryWizard />
    </PageLayout>
  );
}
