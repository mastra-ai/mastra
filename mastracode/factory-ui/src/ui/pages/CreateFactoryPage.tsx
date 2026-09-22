import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { FactoryPage } from '../domains/factory/components/FactoryPage';
import { FactoryBreadcrumbs } from '../ui/FactoryBreadcrumbs';
import { CreateFactoryWizard } from '../domains/workspaces/components/create-factory/CreateFactoryWizard';

/** Inline wizard: the sidebar stays; onboarding owns the full-screen first-run variant. */
export function CreateFactoryPage() {
  return (
    <FactoryPage>
      {project => (
        <PageLayout
          variant="fit"
          breadcrumbs={
            <FactoryBreadcrumbs
              crumbs={[
                { id: 'factory', label: project.name, to: `/factories/${project.id}/overview` },
                { id: 'new-factory', label: 'New factory' },
              ]}
            />
          }
        >
          <CreateFactoryWizard />
        </PageLayout>
      )}
    </FactoryPage>
  );
}
