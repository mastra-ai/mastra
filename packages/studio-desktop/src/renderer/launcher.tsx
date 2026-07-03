import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Logo } from '@mastra/playground-ui/components/Logo';
import { Section } from '@mastra/playground-ui/components/Section';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';

import type { DesktopState, DesktopTab, PlatformProject } from '../shared/types';

export interface LauncherActions {
  onManualServerUrlChange: (value: string) => void;
  onCreateAgent: () => void;
  onOpenActiveExternal: () => void;
  onOpenDefaultLocal: () => void;
  onOpenManualLocal: () => void;
  onOpenPlatformProject: (projectId: string) => void;
  onOpenTemplate: () => void;
  onOpenSettings: () => void;
  onPlatformBaseUrlChange: (value: string) => void;
  onPlatformLogin: () => void;
  onPlatformLogout: () => void;
  onPlatformRefresh: () => void;
  onReloadActiveTab: () => void;
  onSavePlatformBase: () => void;
}

export interface LauncherProps {
  activeTab: DesktopTab | undefined;
  busyAction: string | undefined;
  current: DesktopState;
  lastError: string | undefined;
  manualServerUrl: string;
  platformBaseUrl: string;
  actions: LauncherActions;
}

function projectStatus(project: PlatformProject) {
  if (!project.instanceUrl) return 'No Studio URL';
  return project.latestDeployStatus ?? 'unknown';
}

function projectStatusVariant(project: PlatformProject): 'success' | 'error' | 'neutral' {
  if (!project.instanceUrl) return 'neutral';
  if (['running', 'sleeping', 'stopped'].includes(project.latestDeployStatus ?? '')) return 'success';
  if (project.latestDeployStatus === 'failed') return 'error';
  return 'neutral';
}

function SourceRow({
  title,
  subtitle,
  action,
  disabled,
  onClick,
}: {
  title: string;
  subtitle: string;
  action: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="ghost" size="lg" className="studio-source-row" disabled={disabled} onClick={onClick}>
      <span className="studio-source-copy">
        <span className="studio-source-title">{title}</span>
        <span className="studio-source-subtitle">{subtitle}</span>
      </span>
      <span className="studio-source-action">{action}</span>
    </Button>
  );
}

function LocalStudioSection(props: LauncherProps) {
  const { actions, busyAction, current, manualServerUrl } = props;

  return (
    <Section className="source-panel local-source">
      <header className="source-header">
        <Badge size="xs">Local</Badge>
        <h2>Studio on this Mac</h2>
        <p>Bundled template, local models, or a running Mastra dev server.</p>
      </header>

      <div className="source-list">
        <SourceRow
          title="Bundled Template"
          subtitle="Local starter runtime with the default desktop assistant"
          action="Open"
          onClick={actions.onOpenTemplate}
        />

        <SourceRow
          title="Create agent"
          subtitle="Build a local agent with the selected Ollama or LM Studio model"
          action="Create"
          onClick={actions.onCreateAgent}
        />

        <SourceRow
          title="LM Studio, Ollama & API keys"
          subtitle="Configure local models, provider keys, and bundled runtime environment"
          action="Settings"
          onClick={actions.onOpenSettings}
        />

        <SourceRow
          title="Localhost :4111"
          subtitle="Connect to a running mastra dev server"
          action={busyAction === 'open-default-local' ? 'Probing...' : 'Probe'}
          onClick={actions.onOpenDefaultLocal}
        />

        <div className="manual-server-row">
          <label htmlFor="manual-server-url">
            <span>Connect local server</span>
            <Input
              id="manual-server-url"
              value={manualServerUrl}
              placeholder={current.settings.devServerUrl}
              size="sm"
              onChange={event => actions.onManualServerUrlChange(event.currentTarget.value)}
            />
          </label>
          <Button type="button" size="sm" variant="default" onClick={actions.onOpenManualLocal}>
            {busyAction === 'open-manual-local' ? 'Opening...' : 'Open'}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function PlatformProjectRow({
  project,
  onOpenPlatformProject,
}: {
  project: PlatformProject;
  onOpenPlatformProject: (projectId: string) => void;
}) {
  const disabled = !project.instanceUrl;

  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      className="studio-source-row platform-row"
      disabled={disabled}
      onClick={() => onOpenPlatformProject(project.id)}
    >
      <span className="studio-source-copy">
        <span className="studio-source-title">{project.name}</span>
        <span className="studio-source-subtitle">{project.instanceUrl ?? project.slug}</span>
      </span>
      <StatusBadge variant={projectStatusVariant(project)} size="sm" withDot={project.latestDeployStatus === 'running'}>
        {projectStatus(project)}
      </StatusBadge>
    </Button>
  );
}

function PlatformRows({
  actions,
  current,
  platformBaseUrl,
  busyAction,
}: Pick<LauncherProps, 'actions' | 'busyAction' | 'current' | 'platformBaseUrl'>) {
  if (!current.platform.signedIn) {
    return (
      <>
        <SourceRow
          title="Sign in to Mastra"
          subtitle="List hosted Studio projects from your Platform account"
          action={busyAction === 'platform-login' ? 'Opening...' : 'Connect'}
          onClick={actions.onPlatformLogin}
        />
        <div className="manual-server-row">
          <label htmlFor="platform-api-url">
            <span>Platform API URL</span>
            <Input
              id="platform-api-url"
              value={platformBaseUrl || current.settings.platformBaseUrl}
              size="sm"
              onChange={event => actions.onPlatformBaseUrlChange(event.currentTarget.value)}
            />
          </label>
          <Button type="button" size="sm" variant="default" onClick={actions.onSavePlatformBase}>
            Set
          </Button>
        </div>
      </>
    );
  }

  const projects = current.platform.projects.filter(project => project.studioEnabled || project.instanceUrl);

  if (projects.length === 0) {
    return <p className="launcher-message">No hosted Studio is available for this organization.</p>;
  }

  return (
    <>
      {projects.map(project => (
        <PlatformProjectRow key={project.id} project={project} onOpenPlatformProject={actions.onOpenPlatformProject} />
      ))}
    </>
  );
}

function PlatformStudioSection({
  actions,
  busyAction,
  current,
  lastError,
  platformBaseUrl,
}: Pick<LauncherProps, 'actions' | 'busyAction' | 'current' | 'lastError' | 'platformBaseUrl'>) {
  const platformStatus =
    current.platform.status === 'error'
      ? current.platform.error
      : current.platform.status === 'signing-in'
        ? 'Waiting for browser sign-in...'
        : current.platform.status === 'loading'
          ? 'Loading Platform projects...'
          : undefined;

  return (
    <Section className="source-panel platform-source">
      <header className="source-header platform-header">
        <span>
          <Badge size="xs">Platform</Badge>
          <h2>Hosted Studios</h2>
          <p>Studios attached to your Mastra Platform account.</p>
        </span>
        {current.platform.signedIn ? (
          <ButtonsGroup spacing="default">
            <Button type="button" size="sm" variant="outline" onClick={actions.onPlatformRefresh}>
              {busyAction === 'platform-refresh' ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={actions.onPlatformLogout}>
              Sign out
            </Button>
          </ButtonsGroup>
        ) : null}
      </header>

      <div className="source-list">
        {platformStatus ? <p className="launcher-message">{platformStatus}</p> : null}
        {lastError ? <p className="launcher-message error">{lastError}</p> : null}
        <PlatformRows
          actions={actions}
          busyAction={busyAction}
          current={current}
          platformBaseUrl={platformBaseUrl}
        />
      </div>
    </Section>
  );
}

function StudioError({
  activeTab,
  actions,
}: Pick<LauncherProps, 'actions' | 'activeTab'>) {
  return (
    <div className="launcher-shell error-shell">
      <Section className="studio-error">
        <Badge variant="error" size="sm">
          Error
        </Badge>
        <h2>Studio failed to load</h2>
        <p>{activeTab?.error ?? 'The Studio tab could not be loaded.'}</p>
        {activeTab?.url ? <code>{activeTab.url}</code> : null}
        <ButtonsGroup spacing="default">
          <Button type="button" size="sm" variant="default" onClick={actions.onReloadActiveTab}>
            Reload
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={actions.onOpenActiveExternal}>
            Open in browser
          </Button>
        </ButtonsGroup>
      </Section>
    </div>
  );
}

export function Launcher(props: LauncherProps) {
  if (props.activeTab?.status === 'error') {
    return <StudioError activeTab={props.activeTab} actions={props.actions} />;
  }

  return (
    <div className="launcher-shell">
      <header className="launcher-hero">
        <span className="brand-lockup">
          <Logo size="sm" aria-label="Mastra" />
          <span>Mastra Studio</span>
        </span>
      </header>

      <div className="launcher-columns">
        <LocalStudioSection {...props} />
        <PlatformStudioSection
          actions={props.actions}
          busyAction={props.busyAction}
          current={props.current}
          lastError={props.lastError}
          platformBaseUrl={props.platformBaseUrl}
        />
      </div>
    </div>
  );
}
