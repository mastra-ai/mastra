import {
  useLinkComponent,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
  MainContentLayout,
  HeaderAction,
  Button,
  Spinner,
} from '@mastra/playground-ui';
import { useAgentCmsForm, AgentCmsFormShell } from '@mastra/playground-ui/agents';
import { Check } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';

function CreateLayoutWrapper() {
  const { navigate, paths } = useLinkComponent();
  const location = useLocation();

  const { form, handlePublish, isSubmitting, canPublish } = useAgentCmsForm({
    mode: 'create',
    onSuccess: agentId => navigate(paths.agentLink(agentId)),
  });

  return (
    <MainContentLayout>
      <Header className="bg-surface1">
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create an agent
        </HeaderTitle>

        <HeaderAction>
          <Button variant="primary" onClick={handlePublish} disabled={isSubmitting || !canPublish} className="w-full">
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
        </HeaderAction>
      </Header>
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
