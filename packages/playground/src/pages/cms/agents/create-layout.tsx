import { Outlet, useLocation } from 'react-router';

import {
  useLinkComponent,
  useAgentCmsForm,
  AgentCmsFormShell,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
  MainContentLayout,
} from '@mastra/playground-ui';

function CreateLayoutWrapper() {
  const { navigate, paths } = useLinkComponent();
  const location = useLocation();

  const { form, handlePublish, isSubmitting } = useAgentCmsForm({
    mode: 'create',
    onSuccess: agentId => navigate(paths.agentLink(agentId)),
  });

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create an agent
        </HeaderTitle>
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
