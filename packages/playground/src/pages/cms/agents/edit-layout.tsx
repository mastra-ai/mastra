import {
  AgentIcon,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Header,
  HeaderAction,
  HeaderTitle,
  Icon,
  MainContentLayout,
  Skeleton,
  Spinner,
} from '@mastra/playground-ui';
import { Check, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentCmsFormShell } from '@/domains/agents/components/agent-cms-form-shell';
import { AgentVersionPanel } from '@/domains/agents/components/agent-version-panel';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useAgentVersion, useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { useLinkComponent } from '@/lib/framework';

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
  hideVersionPanel = false,
  isCodeAgentOverride = false,
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
  hideVersionPanel?: boolean;
  isCodeAgentOverride?: boolean;
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

  const rightPanel = hideVersionPanel ? undefined : (
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
      isCodeAgentOverride={isCodeAgentOverride}
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
  const routerNavigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');

  // Fetch the code/merged agent (GET /agents/:id) to determine source
  const { data: codeAgent, isLoading: isLoadingCodeAgent } = useAgent(agentId);

  // Fetch versions first — this endpoint returns an empty array for code-only agents
  const { data: versionsData } = useAgentVersions({
    agentId: agentId ?? '',
    params: { sortDirection: 'DESC' },
  });

  // Only fetch stored agent details when versions exist (avoids 404 for code-only agents)
  const hasVersions = (versionsData?.versions?.length ?? 0) > 0;
  const { data: storedAgent, isLoading: isLoadingStoredAgent } = useStoredAgent(agentId, {
    status: 'draft',
    enabled: hasVersions,
  });

  // A code agent override is when the underlying agent is code-defined,
  // regardless of whether a stored override record already exists
  const isCodeAgentOverride = codeAgent?.source === 'code';
  const agent = storedAgent ?? null;
  const isLoading = isLoadingCodeAgent || (hasVersions && isLoadingStoredAgent);

  // Redirect code agent overrides from the Identity page to Instructions
  const basePath = `/cms/agents/${agentId}/edit`;
  const isOnIdentityPage = location.pathname === basePath || location.pathname === `${basePath}/`;
  useEffect(() => {
    if (isCodeAgentOverride && isOnIdentityPage) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      routerNavigate(`${basePath}/instruction-blocks${location.search}${location.hash}`, { replace: true });
    }
  }, [isCodeAgentOverride, isOnIdentityPage, routerNavigate, basePath, location.search, location.hash]);

  const { data: versionData } = useAgentVersion({
    agentId: agentId ?? '',
    versionId: selectedVersionId ?? '',
  });

  const activeVersionId = agent?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !!(latestVersion && latestVersion.id !== activeVersionId);

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersion?.id;
  const dataSource = useMemo<AgentDataSource>(() => {
    if (isViewingVersion && versionData) return versionData;
    if (agent) return agent;
    if (codeAgent) return mapAgentResponseToDataSource(codeAgent);
    return {} as AgentDataSource;
  }, [isViewingVersion, versionData, agent, codeAgent]);

  const agentName = agent?.name ?? codeAgent?.name;

  const { form, handlePublish, handleSaveDraft, isSubmitting, isSavingDraft, isDirty } = useAgentCmsForm({
    mode: 'edit',
    agentId: agentId ?? '',
    dataSource,
    isCodeAgentOverride,
    hasStoredOverride: isCodeAgentOverride && !!storedAgent,
    onSuccess: id => navigate(paths.agentLink(id)),
  });

  const handlePublishVersion = useCallback(async () => {
    if (isViewingPreviousVersion && selectedVersionId) {
      await handlePublish(selectedVersionId);
    } else {
      await handlePublish();
    }
  }, [handlePublish, isViewingPreviousVersion, selectedVersionId]);

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

  const isNotFound = !isLoading && !agent && !codeAgent;
  const isReady = !isLoading && !!agentId && (!!agent || !!codeAgent);

  return (
    <MainContentLayout>
      <Header className="bg-surface1">
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          {isLoading && <Skeleton className="h-6 w-[200px]" />}
          {isNotFound && 'Agent not found'}
          {isReady && `Edit agent: ${agentName}`}
          {isReady && hasDraft && <Badge variant="info">Unpublished changes</Badge>}
        </HeaderTitle>
        {isReady && (
          <HeaderAction>
            <Button onClick={handleSaveDraft} disabled={!isDirty || isSavingDraft || isSubmitting}>
              {isSavingDraft ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save />
                  Save
                </>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={handlePublishVersion}
              disabled={
                isViewingPreviousVersion
                  ? selectedVersionId === activeVersionId || isSubmitting || isSavingDraft
                  : !hasDraft || isSubmitting || isSavingDraft
              }
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Publishing...
                </>
              ) : (
                <>
                  <Check />
                  {isViewingPreviousVersion ? 'Publish This Version' : 'Publish'}
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
          hideVersionPanel={isCodeAgentOverride && !storedAgent}
          isCodeAgentOverride={isCodeAgentOverride}
        />
      )}
    </MainContentLayout>
  );
}

export { EditLayoutWrapper };
