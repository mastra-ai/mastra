import type { AgentVersionResponse, GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgent, useStoredAgent } from '@mastra/react/hooks/agents';
import { useMastraPackages } from '@mastra/react/hooks/configuration';
import { Download, GitPullRequest, Save, Eye } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentCmsFormShell } from '@/domains/agents/components/agent-cms-form-shell';
import { getCodeAgentOverrideSections } from '@/domains/agents/components/agent-cms-sidebar/agent-cms-sections';
import type { AgentVersionLabelRefreshOptions } from '@/domains/agents/components/agent-version-label-dialogs';
import { AgentVersionPanel } from '@/domains/agents/components/agent-version-panel';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useAgentVersion, useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { getEditorOwnership } from '@/domains/agents/utils/editor-ownership';
import { useAgentVersionAccess } from '@/domains/auth/hooks/use-agent-version-access';
import { CmsEditHeaderActions } from '@/domains/cms/components/cms-edit-header-actions';
import { useEditorSource } from '@/domains/configuration/hooks/use-editor-source';
import { agentCrumb, navCrumb } from '@/domains/navigation/crumbs';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

const crumbs = [navCrumb('/agents'), agentCrumb];

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
  isCodeSourceAgent = false,
  isSourceProviderBacked = false,
  canPublish = false,
  isPublishPermissionLoading = true,
  isPublishPermissionError = false,
  isProductionStateError = false,
  isProductionStateFetching = false,
  onRetryProductionState,
  editorConfig,
}: {
  agentId: string;
  selectedVersionId: string | null;
  versionData?: AgentVersionResponse;
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
  isCodeSourceAgent?: boolean;
  isSourceProviderBacked?: boolean;
  canPublish?: boolean;
  isPublishPermissionLoading?: boolean;
  isPublishPermissionError?: boolean;
  isProductionStateError?: boolean;
  isProductionStateFetching?: boolean;
  onRetryProductionState?: (options?: AgentVersionLabelRefreshOptions) => Promise<void>;
  editorConfig?: NonNullable<GetAgentResponse>['editor'];
}) {
  const [, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersionId;

  const banner = isViewingPreviousVersion ? (
    <Notice variant="info" title="This is a previous version" className="mb-4">
      <Notice.Message>You are seeing a specific version of the agent.</Notice.Message>
      <div className="flex items-center gap-2">
        <Button icon={<Eye />} type="button" variant="default" size="sm" onClick={() => setSearchParams({})}>
          View latest version
        </Button>
      </div>
    </Notice>
  ) : undefined;

  const rightPanel = hideVersionPanel ? undefined : (
    <AgentVersionPanel
      agentId={agentId}
      selectedVersionId={selectedVersionId ?? undefined}
      onVersionSelect={onVersionSelect}
      activeVersionId={activeVersionId}
      isSourceProviderBacked={isSourceProviderBacked}
      canPublish={canPublish}
      isPublishPermissionLoading={isPublishPermissionLoading}
      isPublishPermissionError={isPublishPermissionError}
      isProductionStateError={isProductionStateError}
      isProductionStateFetching={isProductionStateFetching}
      onRetryProductionState={onRetryProductionState}
    />
  );
  const isEditorLocked = getEditorOwnership(isCodeAgentOverride, editorConfig).isFullyLocked;

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
      isCodeSourceAgent={isCodeSourceAgent}
      editorConfig={editorConfig}
      basePath={`/cms/agents/${agentId}/edit`}
      currentPath={pathname}
      banner={banner}
      versionId={selectedVersionId ?? undefined}
      rightPanel={rightPanel}
    >
      {isEditorLocked ? (
        <div className="p-4">
          <Notice variant="info" title="Editing disabled">
            <Notice.Message>This code-defined agent has disabled Studio editing.</Notice.Message>
          </Notice>
        </div>
      ) : (
        <Outlet />
      )}
    </AgentCmsFormShell>
  );
}

function EditLayoutWrapper() {
  const { agentId } = useParams<{ agentId: string }>();
  const { navigate, paths } = useLinkComponent();
  const routerNavigate = useNavigate();
  const { hash, pathname, search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');
  const { isMastraPlatform, mastraPlatformApiEndpoint, mastraPlatformProjectId } = useMastraPlatform();

  // Fetch the code/merged agent (GET /agents/:id) to determine source
  const { data: codeAgent, isLoading: isLoadingCodeAgent } = useAgent({
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const versionAccess = useAgentVersionAccess(agentId);
  const packagesQuery = useMastraPackages();

  // Fetch versions first — this endpoint returns an empty array for code-only agents
  const { data: versionsData } = useAgentVersions(
    {
      agentId,
      params: { orderBy: { direction: 'DESC' } },
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  // Only fetch stored agent details when versions exist (avoids 404 for code-only agents)
  const hasVersions = (versionsData?.versions?.length ?? 0) > 0;
  const {
    data: storedAgent,
    isLoading: isLoadingStoredAgent,
    isError: isStoredAgentError,
    isFetching: isFetchingStoredAgent,
    refetch: refetchStoredAgent,
  } = useStoredAgent({
    agentId,
    status: 'draft',
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) && hasVersions },
  });

  // A code agent override is when the underlying agent is code-defined,
  // regardless of whether a stored override record already exists
  const isCodeAgentOverride = codeAgent?.source === 'code';
  const isSourceProviderBacked =
    isCodeAgentOverride && packagesQuery.data?.editorSourceCapabilities?.storage === 'source-provider';
  const codeAgentOverrideSections = useMemo(
    () => (isCodeAgentOverride ? getCodeAgentOverrideSections(codeAgent?.editor) : []),
    [codeAgent?.editor, isCodeAgentOverride],
  );
  const agent = storedAgent ?? null;
  const isLoading = isLoadingCodeAgent || (hasVersions && isLoadingStoredAgent);

  // Redirect code agent overrides away from non-editable sections.
  const basePath = `/cms/agents/${agentId}/edit`;
  const isOnIdentityPage = pathname === basePath || pathname === `${basePath}/`;
  useEffect(() => {
    if (!isCodeAgentOverride || codeAgentOverrideSections.length === 0) return;

    const isAllowedPath = codeAgentOverrideSections.some(section => pathname === `${basePath}${section.pathSuffix}`);
    if (isOnIdentityPage || !isAllowedPath) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      routerNavigate(`${basePath}${codeAgentOverrideSections[0].pathSuffix}${search}${hash}`, { replace: true });
    }
  }, [
    codeAgentOverrideSections,
    isCodeAgentOverride,
    isOnIdentityPage,
    pathname,
    routerNavigate,
    basePath,
    search,
    hash,
  ]);

  const { data: versionData } = useAgentVersion(
    {
      agentId: agentId ?? '',
      versionId: selectedVersionId ?? '',
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  const activeVersionId = agent?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !isStoredAgentError && !!(latestVersion && latestVersion.id !== activeVersionId);

  const handleRetryProductionState = async (options?: AgentVersionLabelRefreshOptions): Promise<void> => {
    const result = await refetchStoredAgent({ throwOnError: options?.throwOnError });
    if (result.error) throw result.error;
  };

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const dataSource = useMemo<AgentDataSource>(() => {
    if (isViewingVersion && versionData) return versionData;
    if (agent) return agent;
    if (codeAgent) return mapAgentResponseToDataSource(codeAgent);
    return {} as AgentDataSource;
  }, [isViewingVersion, versionData, agent, codeAgent]);

  const {
    form,
    handlePublish,
    handleSaveDraft,
    handleDownloadJson,
    handleOpenPr,
    isSubmitting,
    isSavingDraft,
    isDirty,
  } = useAgentCmsForm(
    {
      mode: 'edit',
      agentId: agentId ?? '',
      dataSource,
      isCodeAgentOverride,
      hasStoredOverride: isCodeAgentOverride && !!storedAgent,
      editorConfig: codeAgent?.editor,
      onSuccess: id => navigate(paths.agentLink(id)),
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

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
  const isCodeAgentEditable = !getEditorOwnership(isCodeAgentOverride, codeAgent?.editor).isFullyLocked;
  const editorSource = useEditorSource();
  const showCodeModeActions = isCodeAgentOverride && editorSource === 'code';
  const canOpenPr = isCodeAgentEditable && isMastraPlatform && !!mastraPlatformApiEndpoint && !!mastraPlatformProjectId;
  const openPrTitle = canOpenPr
    ? 'Open a pull request with this agent override JSON'
    : 'Open PR is available on Mastra-hosted projects with GitHub App support';

  const actions = isReady && (
    <CmsEditHeaderActions hasDraft={hasDraft}>
      {showCodeModeActions ? (
        isCodeAgentEditable ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleDownloadJson()}
              disabled={isSavingDraft || isSubmitting}
              icon={<Download />}
            >
              Download JSON
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!canOpenPr || isSavingDraft || isSubmitting}
              title={openPrTitle}
              onClick={() => {
                if (!mastraPlatformApiEndpoint || !mastraPlatformProjectId) return;
                void handleOpenPr({
                  platformApiEndpoint: mastraPlatformApiEndpoint,
                  projectId: mastraPlatformProjectId,
                });
              }}
            >
              <GitPullRequest />
              Open PR
            </Button>
          </>
        ) : null
      ) : !isCodeAgentEditable ? null : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleSaveDraft()}
            disabled={!isDirty || isSavingDraft || isSubmitting}
          >
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
        </>
      )}
    </CmsEditHeaderActions>
  );

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={actions}>
      <h1 className="sr-only">{agentId}</h1>
      {isNotFound ? (
        <>
          <EmptyState variant="fill" titleSlot="Agent not found" />
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
              canPublish={versionAccess.canPublish}
              isPublishPermissionLoading={versionAccess.isLoading}
              isPublishPermissionError={versionAccess.isError}
              isProductionStateError={hasVersions && isStoredAgentError}
              isProductionStateFetching={isFetchingStoredAgent}
              onRetryProductionState={handleRetryProductionState}
              editorConfig={undefined}
            />
          </div>
        </>
      ) : (
        <EditFormContent
          agentId={agentId ?? ''}
          selectedVersionId={selectedVersionId}
          versionData={versionData}
          readOnly={!isCodeAgentEditable}
          form={form}
          handlePublish={handlePublish}
          handleSaveDraft={handleSaveDraft}
          isSubmitting={isSubmitting}
          isSavingDraft={isSavingDraft}
          onVersionSelect={handleVersionSelect}
          activeVersionId={activeVersionId}
          latestVersionId={latestVersion?.id}
          hideVersionPanel={isCodeAgentOverride && !storedAgent && !hasVersions}
          isCodeAgentOverride={isCodeAgentOverride}
          isCodeSourceAgent={showCodeModeActions}
          isSourceProviderBacked={isSourceProviderBacked}
          canPublish={versionAccess.canPublish}
          isPublishPermissionLoading={versionAccess.isLoading}
          isPublishPermissionError={versionAccess.isError}
          isProductionStateError={hasVersions && isStoredAgentError}
          isProductionStateFetching={isFetchingStoredAgent}
          onRetryProductionState={handleRetryProductionState}
          editorConfig={codeAgent?.editor}
        />
      )}
    </PageLayout>
  );
}

export { EditLayoutWrapper };
