import { useCallback } from 'react';
import { Outlet, useLocation, useParams, useSearchParams } from 'react-router';

import {
  useLinkComponent,
  useStoredAgent,
  useAgentVersion,
  useAgentCmsForm,
  AgentCmsFormShell,
  AgentVersionCombobox,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  AgentIcon,
  Spinner,
  MainContentLayout,
  Skeleton,
  Alert,
  Button,
  AlertTitle,
  type StoredAgent,
  type AgentDataSource,
} from '@mastra/playground-ui';
import { Check } from 'lucide-react';

function EditFormContent({
  agentId,
  selectedVersionId,
  versionData,
  readOnly = false,
  form,
  handlePublish,
  isSubmitting,
}: {
  agentId: string;
  selectedVersionId: string | null;
  versionData?: ReturnType<typeof useAgentVersion>['data'];
  readOnly?: boolean;
  form: ReturnType<typeof useAgentCmsForm>['form'];
  handlePublish: ReturnType<typeof useAgentCmsForm>['handlePublish'];
  isSubmitting: boolean;
}) {
  const [, setSearchParams] = useSearchParams();
  const location = useLocation();

  const isViewingVersion = !!selectedVersionId && !!versionData;

  const banner = isViewingVersion ? (
    <Alert variant="info" className="mb-4 mx-4">
      <AlertTitle>You are seeing a specific version of the agent.</AlertTitle>
      <div className="pt-2">
        <Button type="button" variant="light" onClick={() => setSearchParams({})}>
          View latest version
        </Button>
      </div>
    </Alert>
  ) : undefined;

  return (
    <AgentCmsFormShell
      form={form}
      mode="edit"
      agentId={agentId}
      isSubmitting={isSubmitting}
      handlePublish={handlePublish}
      readOnly={readOnly || isViewingVersion}
      basePath={`/cms/agents/${agentId}/edit`}
      currentPath={location.pathname}
      banner={banner}
    >
      <Outlet />
    </AgentCmsFormShell>
  );
}

function EditLayoutWrapper() {
  const { agentId } = useParams<{ agentId: string }>();
  const { navigate, paths } = useLinkComponent();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');

  const { data: agent, isLoading: isLoadingAgent } = useStoredAgent(agentId);
  const { data: versionData, isLoading: isLoadingVersion } = useAgentVersion({
    agentId: agentId ?? '',
    versionId: selectedVersionId ?? '',
  });

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const dataSource = (isViewingVersion ? versionData : agent) ?? ({} as AgentDataSource);

  const { form, handlePublish, isSubmitting } = useAgentCmsForm({
    mode: 'edit',
    agentId: agentId ?? '',
    dataSource,
    onSuccess: id => navigate(`${paths.agentLink(id)}/chat`),
  });

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      if (versionId) {
        setSearchParams({ versionId });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

  if (isLoadingAgent) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <AgentIcon />
            </Icon>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
        <div className="flex items-center justify-center h-full">
          <Spinner className="h-8 w-8" />
        </div>
      </MainContentLayout>
    );
  }

  if (!agent || !agentId) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <AgentIcon />
            </Icon>
            Agent not found
          </HeaderTitle>
        </Header>
        <div className="flex items-center justify-center h-full text-icon3">Agent not found</div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Edit agent: {agent.name}
        </HeaderTitle>
        <HeaderAction>
          {!isViewingVersion && (
            <Button variant="primary" onClick={handlePublish} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Updating...
                </>
              ) : (
                <>
                  <Icon>
                    <Check />
                  </Icon>
                  Update agent
                </>
              )}
            </Button>
          )}
          <AgentVersionCombobox
            agentId={agentId}
            value={selectedVersionId ?? ''}
            onValueChange={handleVersionSelect}
            variant="outline"
          />
        </HeaderAction>
      </Header>

      <EditFormContent
        agentId={agentId}
        selectedVersionId={selectedVersionId}
        versionData={versionData}
        readOnly={isLoadingVersion}
        form={form}
        handlePublish={handlePublish}
        isSubmitting={isSubmitting}
      />
    </MainContentLayout>
  );
}

export { EditLayoutWrapper };
