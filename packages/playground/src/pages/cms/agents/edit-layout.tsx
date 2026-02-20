import { useCallback, useMemo } from 'react';
import { Outlet, useLocation, useParams, useSearchParams } from 'react-router';

import {
  useLinkComponent,
  useStoredAgent,
  useAgentVersion,
  useAgentVersions,
  useAgentCmsForm,
  AgentCmsFormShell,
  AgentVersionPanel,
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
  Badge,
  type AgentDataSource,
  AlertDescription,
} from '@mastra/playground-ui';
import { Check, Save } from 'lucide-react';

function EditFormContent({
  agentId,
  selectedVersionId,
  versionData,
  readOnly = false,
  form,
  handlePublish,
  handleSaveDraft,
  isSubmitting,
  isSavingDraft,
  onVersionSelect,
  activeVersionId,
  latestVersionId,
}: {
  agentId: string;
  selectedVersionId: string | null;
  versionData?: ReturnType<typeof useAgentVersion>['data'];
  readOnly?: boolean;
  form: ReturnType<typeof useAgentCmsForm>['form'];
  handlePublish: ReturnType<typeof useAgentCmsForm>['handlePublish'];
  handleSaveDraft: ReturnType<typeof useAgentCmsForm>['handleSaveDraft'];
  isSubmitting: boolean;
  isSavingDraft: boolean;
  onVersionSelect: (versionId: string) => void;
  activeVersionId?: string;
  latestVersionId?: string;
}) {
  const [, setSearchParams] = useSearchParams();
  const location = useLocation();

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersionId;

  const banner = isViewingPreviousVersion ? (
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

  const rightPanel = (
    <AgentVersionPanel
      agentId={agentId}
      selectedVersionId={selectedVersionId ?? undefined}
      onVersionSelect={onVersionSelect}
      activeVersionId={activeVersionId}
    />
  );

  return (
    <AgentCmsFormShell
      form={form}
      mode="edit"
      agentId={agentId}
      isSubmitting={isSubmitting}
      isSavingDraft={isSavingDraft}
      handlePublish={handlePublish}
      handleSaveDraft={handleSaveDraft}
      readOnly={readOnly}
      basePath={`/cms/agents/${agentId}/edit`}
      currentPath={location.pathname}
      banner={banner}
      versionId={selectedVersionId ?? undefined}
      rightPanel={rightPanel}
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

  const { data: agent, isLoading: isLoadingAgent } = useStoredAgent(agentId, { status: 'draft' });
  const { data: versionData, isLoading: isLoadingVersion } = useAgentVersion({
    agentId: agentId ?? '',
    versionId: selectedVersionId ?? '',
  });
  const { data: versionsData } = useAgentVersions({
    agentId: agentId ?? '',
    params: { sortDirection: 'DESC' },
  });

  const activeVersionId = agent?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !!(latestVersion && latestVersion.id !== activeVersionId);

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const dataSource = useMemo<AgentDataSource>(() => {
    if (isViewingVersion && versionData) return versionData;
    if (agent) return agent;
    return {} as AgentDataSource;
  }, [isViewingVersion, versionData, agent]);

  const { form, handlePublish, handleSaveDraft, isSubmitting, isSavingDraft } = useAgentCmsForm({
    mode: 'edit',
    agentId: agentId ?? '',
    dataSource,
    onSuccess: id => navigate(paths.agentLink(id)),
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
          {isReady && hasDraft && <Badge variant="info">Unpublished changes</Badge>}
        </HeaderTitle>
        {isReady && (
          <HeaderAction>
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting}>
              {isSavingDraft ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon>
                    <Save />
                  </Icon>
                  Save
                </>
              )}
            </Button>
            <Button variant="primary" onClick={handlePublish} disabled={isSubmitting || isSavingDraft}>
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Publishing...
                </>
              ) : (
                <>
                  <Icon>
                    <Check />
                  </Icon>
                  Publish
                </>
              )}
            </Button>
          </HeaderAction>
        )}
      </Header>

      {isNotFound ? (
        <>
          <div className="flex items-center justify-center h-full text-neutral3">Agent not found</div>
          <div className="hidden">
            <EditFormContent
              agentId={agentId ?? ''}
              selectedVersionId={selectedVersionId}
              versionData={versionData}
              readOnly
              form={form}
              handlePublish={handlePublish}
              handleSaveDraft={handleSaveDraft}
              isSubmitting={isSubmitting}
              isSavingDraft={isSavingDraft}
              onVersionSelect={handleVersionSelect}
              activeVersionId={activeVersionId}
              latestVersionId={latestVersion?.id}
            />
          </div>
        </>
      ) : (
        <EditFormContent
          agentId={agentId ?? ''}
          selectedVersionId={selectedVersionId}
          versionData={versionData}
          form={form}
          handlePublish={handlePublish}
          handleSaveDraft={handleSaveDraft}
          isSubmitting={isSubmitting}
          isSavingDraft={isSavingDraft}
          onVersionSelect={handleVersionSelect}
          activeVersionId={activeVersionId}
          latestVersionId={latestVersion?.id}
        />
      )}
    </MainContentLayout>
  );
}

export { EditLayoutWrapper };
