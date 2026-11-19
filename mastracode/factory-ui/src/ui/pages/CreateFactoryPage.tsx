import { FormLayout } from '@mastra/playground-ui/components/FormLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { CreateFactoryWizard } from '../domains/workspaces/components/create-factory/CreateFactoryWizard';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { HrefLink } from '../ui/HrefLink';

/** Inline wizard: the sidebar stays; onboarding owns the full-screen first-run variant. */
export function CreateFactoryPage() {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <FormLayout
      breadcrumbs={slots.breadcrumbs}
      backHref={`/factories/${factory.id}`}
      backLabel={factory.name}
      title="New Factory"
      LinkComponent={HrefLink}
    >
      <CreateFactoryWizard />
    </FormLayout>
  );
}
