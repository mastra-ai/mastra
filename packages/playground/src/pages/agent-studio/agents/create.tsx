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
import { useMastraClient } from '@mastra/react';
import { Check } from 'lucide-react';
import { useCallback } from 'react';
import { Outlet, useLocation } from 'react-router';

import { AgentCmsFormShell } from '@/domains/agents/components/agent-cms-form-shell';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import {
  PendingAvatarProvider,
  useOptionalPendingAvatar,
} from '@/domains/agent-studio/components/pending-avatar-context';
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
  return (
    <PendingAvatarProvider>
      <AgentStudioAgentCreateInner />
    </PendingAvatarProvider>
  );
}

function AgentStudioAgentCreateInner() {
  const { navigate } = useLinkComponent();
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const client = useMastraClient();
  const pendingAvatarCtx = useOptionalPendingAvatar();

  const onAfterCreate = useCallback(
    async (agentId: string) => {
      const pending = pendingAvatarCtx?.pendingAvatar;
      if (!pending) return;
      await client
        .getStoredAgent(agentId)
        .uploadAvatar({ contentBase64: pending.contentBase64, contentType: pending.contentType });
    },
    [client, pendingAvatarCtx?.pendingAvatar],
  );

  const { form, handlePublish, isSubmitting, canPublish } = useAgentCmsForm({
    mode: 'create',
    authorId: user?.id,
    autoPublish: true,
    onAfterCreate,
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
        simplifiedSections
      >
        <Outlet />
      </AgentCmsFormShell>
    </MainContentLayout>
  );
}

export default AgentStudioAgentCreate;
