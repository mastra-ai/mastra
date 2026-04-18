import {
  AgentIcon,
  Button,
  Header,
  HeaderAction,
  HeaderTitle,
  Icon,
  MainContentLayout,
  Spinner,
} from '@mastra/playground-ui';
import { Check } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { AgentCmsFormShell } from '@/domains/agents/components/agent-cms-form-shell';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

/**
 * Agent Studio variant of the CMS create layout. Differs from
 * `/cms/agents/create` in two ways:
 *   1. It passes the current user's id as `authorId` on the created agent so
 *      the "Mine" scope and author attribution work in the Studio.
 *   2. It navigates to the Agent Studio chat view on success, keeping the
 *      end-user within the Agent Studio shell.
 */
export function AgentStudioAgentCreate() {
  const { navigate } = useLinkComponent();
  const location = useLocation();
  const { data: user } = useCurrentUser();

  const { form, handlePublish, isSubmitting, canPublish } = useAgentCmsForm({
    mode: 'create',
    authorId: user?.id,
    autoPublish: true,
    onSuccess: agentId => navigate(`/agent-studio/agents/${agentId}/chat`),
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
        basePath="/agent-studio/agents/create"
        currentPath={location.pathname}
      >
        <Outlet />
      </AgentCmsFormShell>
    </MainContentLayout>
  );
}

export default AgentStudioAgentCreate;
