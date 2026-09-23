import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { CreateFactoryWizard } from '../domains/workspaces/components/create-factory/CreateFactoryWizard';

/** Inline wizard: the sidebar stays; onboarding owns the full-screen first-run variant. */
export function CreateFactoryPage() {
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout
      {...slots}
      variant="narrow"
      header={
        <PageHeader>
          <PageHeader.Title>New Factory</PageHeader.Title>
        </PageHeader>
      }
    >
      <CreateFactoryWizard />
    </PageLayout>
  );
}
