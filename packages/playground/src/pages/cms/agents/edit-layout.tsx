import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Check, Download, GitPullRequest, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { AgentCmsFormShell } from '@/domains/agents/components/agent-cms-form-shell';
import { getCodeAgentOverrideSections } from '@/domains/agents/components/agent-cms-sidebar/agent-cms-sections';
import { AgentVersionPanel } from '@/domains/agents/components/agent-version-panel';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useAgentVersion, useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { useEditorSource } from '@/domains/configuration/hooks/use-editor-source';
import { useLinkComponent } from '@/lib/framework';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';
import { RouteHeaderActions } from '@/lib/route-header';

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
  editorConfig,
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
  isCodeSourceAgent?: boolean;
  editorConfig?: NonNullable<ReturnType<typeof useAgent>['data']>['editor'];
}) {
  const [, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const isViewingVersion = !!selectedVersionId && !!versionData;
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersionId;

  const banner = isViewingPreviousVersion ? (
    <Notice variant="info" title="This is a previous version" className="mb-4">
      <Notice.Message>You are seeing a specific version of the agent.</Notice.Message>
      <div className="flex items-center gap-2">
        <Button type="button" variant="default" size="sm" onClick={() => setSearchParams({})}>
          View latest version
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void handlePublish(selectedVersionId ?? undefined)}
          disabled={selectedVersionId === activeVersionId}
        >
          Publish This Version
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
    />
  );
  const isEditorLocked = isCodeAgentOverride && editorConfig === false;

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
        <div className="p-6">
          <Notice variant="info" title="Editing disabled">
            <Notice.Message>This code-defined agent has disabled Studio editing with `editor: false`.</Notice.Message>
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
  const { data: codeAgent, isLoading: isLoadingCodeAgent } = useAgent(agentId);

  // Fetch versions first — this endpoint returns an empty array for code-only agents
  const { data: versionsData } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
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

  const {
    form,
    handlePublish,
    handleSaveDraft,
    handleDownloadJson,
    handleOpenPr,
    isSubmitting,
    isSavingDraft,
    isDirty,
  } = useAgentCmsForm({
    mode: 'edit',
    agentId: agentId ?? '',
    dataSource,
    isCodeAgentOverride,
    hasStoredOverride: isCodeAgentOverride && !!storedAgent,
    editorConfig: codeAgent?.editor,
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
  const isCodeAgentEditable = !isCodeAgentOverride || codeAgent?.editor !== false;
  const editorSource = useEditorSource();
  const showCodeModeActions = isCodeAgentOverride && editorSource === 'code';
  const canOpenPr = isCodeAgentEditable && isMastraPlatform && !!mastraPlatformApiEndpoint && !!mastraPlatformProjectId;
  const openPrTitle = canOpenPr
    ? 'Open a pull request with this agent override JSON'
    : 'Open PR is available on Mastra-hosted projects with GitHub App support';

  return (
    <MainContentLayout>
      {isReady && (
        <RouteHeaderActions owner="cms-agent-edit">
          <div className="flex items-center gap-2">
            {hasDraft && <Badge variant="info">Unpublished changes</Badge>}
            {showCodeModeActions ? (
              isCodeAgentEditable ? (
                <>
                  <Button onClick={() => void handleDownloadJson()} disabled={isSavingDraft || isSubmitting}>
                    <Download />
                    Download JSON
                  </Button>
                  <Button
                    variant="primary"
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
                <Button onClick={() => void handleSaveDraft()} disabled={!isDirty || isSavingDraft || isSubmitting}>
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
                  onClick={() => void handlePublishVersion()}
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
              </>
            )}
          </div>
        </RouteHeaderActions>
      )}

      {isNotFound ? (
        <>
          <div className="text-neutral3 flex h-full items-center justify-center">Agent not found</div>
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
          hideVersionPanel={isCodeAgentOverride && !storedAgent}
          isCodeAgentOverride={isCodeAgentOverride}
          isCodeSourceAgent={showCodeModeActions}
          editorConfig={codeAgent?.editor}
        />
      )}
    </MainContentLayout>
  );
}

export { EditLayoutWrapper };
