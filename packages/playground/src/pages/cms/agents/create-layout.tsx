import { Button } from '@mastra/playground-ui/components/Button';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { AgentCmsFormShell } from '@/domains/agents/components/agent-cms-form-shell';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { navCrumb } from '@/domains/navigation/crumbs';
import { useLinkComponent } from '@/lib/framework';

const crumbs = [navCrumb('/agents'), { id: 'create-agent', label: 'Create agent' }];

function CreateLayoutWrapper() {
  const { navigate, paths } = useLinkComponent();
  const location = useLocation();

  const { form, handlePublish, isSubmitting, canPublish } = useAgentCmsForm({
    mode: 'create',
    onSuccess: agentId => navigate(paths.agentLink(agentId)),
  });

  const actions = (
    <Button variant="primary" onClick={() => void handlePublish()} disabled={isSubmitting || !canPublish}>
      {isSubmitting ? (
        <>
          <Spinner className="h-4 w-4" />
          Creating...
        </>
      ) : (
        <>
          <Icon>
            <Check />
          </Icon>
          Create agent
        </>
      )}
    </Button>
  );

  return (
    <MainContentLayout {...pageHeaderProps(crumbs)} actions={actions}>
      <AgentCmsFormShell
        form={form}
        mode="create"
        isSubmitting={isSubmitting}
        handlePublish={handlePublish}
        basePath="/cms/agents/create"
        currentPath={location.pathname}
      >
        <Outlet />
      </AgentCmsFormShell>
    </MainContentLayout>
  );
}

export { CreateLayoutWrapper };
