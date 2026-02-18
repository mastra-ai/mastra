import { useCallback, useMemo } from 'react';
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
  type AgentDataSource,
  AlertDescription,
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
    <Alert variant="info" className="mb-4">
      <AlertTitle>This is a previous version</AlertTitle>
      <AlertDescription as="p">You are seeing a specific version of the agent.</AlertDescription>
      <div className="pt-2">
        <Button type="button" variant="light" size="sm" onClick={() => setSearchParams({})}>
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
      versionId={selectedVersionId ?? undefined}
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
  const dataSource = useMemo<AgentDataSource>(() => {
    if (isViewingVersion && versionData) return versionData;
    if (agent) return agent;
    return {} as AgentDataSource;
  }, [isViewingVersion, versionData, agent]);

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

  const isNotFound = !isLoadingAgent && (!agent || !agentId);
  const isReady = !isLoadingAgent && !!agent && !!agentId;

  return (
    <MainContentLayout>
      <Header className="bg-surface1">
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          {isLoadingAgent && <Skeleton className="h-6 w-[200px]" />}
          {isNotFound && 'Agent not found'}
          {isReady && `Edit agent: ${agent.name}`}
        </HeaderTitle>
        {isReady && (
          <HeaderAction>
            <AgentVersionCombobox
              agentId={agentId}
              value={selectedVersionId ?? ''}
              onValueChange={handleVersionSelect}
              variant="outline"
            />
            {!selectedVersionId && (
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
          </HeaderAction>
        )}
      </Header>

      {isNotFound ? (
        <>
          <div className="flex items-center justify-center h-full text-icon3">Agent not found</div>
          <div className="hidden">
            <EditFormContent
              agentId={agentId ?? ''}
              selectedVersionId={selectedVersionId}
              versionData={versionData}
              readOnly
              form={form}
              handlePublish={handlePublish}
              isSubmitting={isSubmitting}
            />
          </div>
        </>
      ) : (
        <EditFormContent
          agentId={agentId ?? ''}
          selectedVersionId={selectedVersionId}
          versionData={versionData}
          readOnly={isLoadingAgent || isLoadingVersion}
          form={form}
          handlePublish={handlePublish}
          isSubmitting={isSubmitting}
        />
      )}
    </MainContentLayout>
  );
}

export { EditLayoutWrapper };
