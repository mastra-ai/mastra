import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeft, CloudOff, Code2, Database, GitBranch, Info, Lock, Pencil, Plus, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAgent } from '../hooks/use-agent';
import { useActivateAgentVersion, useAgentVersions, useUnpublishAgentVersion } from '../hooks/use-agent-versions';
import { useStoredAgent } from '../hooks/use-stored-agents';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';

export interface AgentSidebarVersionHeaderProps {
  agentId: string;
  agentVersionId?: string;
  selectedVersionId?: string | null;
  threadId?: string;
  onCreateVersion: () => void;
  onVersionSelect?: (versionId: string | null) => void;
  onBack?: () => void;
  showEditorAction?: boolean;
  showCreateVersionAction?: boolean;
}

const DEFAULT_AGENT_OPTION_VALUE = '__mastra_agent_default__';

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DocsLink() {
  return (
    <a
      href="https://mastra.ai/docs/editor/overview"
      target="_blank"
      rel="noopener noreferrer"
      className="text-inherit underline hover:text-white"
    >
      Editor docs
    </a>
  );
}

type VersionSourceHintProps = {
  kind: 'data' | 'code';
  label: string;
  status: string;
};

type VersionTriggerBadge = {
  label: string;
  variant: 'default' | 'success' | 'warning';
};

function VersionSourceTooltipContent({ kind, label, status }: VersionSourceHintProps) {
  const isDataBacked = kind === 'data';
  const SourceIcon = isDataBacked ? Database : Code2;

  return (
    <div className="flex max-w-64 flex-col gap-1.5 text-ui-xs leading-ui-xs">
      <span className="flex min-w-0 items-center gap-2">
        <SourceIcon
          className={cn('size-3.5 shrink-0', isDataBacked ? 'text-amber-700 dark:text-amber-300' : 'text-neutral4')}
        />
        <span className="min-w-0 flex-1 truncate font-medium text-neutral6">{label}</span>
        <span className="shrink-0 text-neutral3">{status}</span>
      </span>
      <span className="text-neutral4">
        {isDataBacked
          ? 'This version is stored in Editor data. A code-only deploy without that data falls back to the code-defined agent.'
          : 'This agent is defined in application code and ships with deployments.'}
      </span>
    </div>
  );
}

function VersionSourceBadge({ badge, sourceHint }: { badge: VersionTriggerBadge; sourceHint: VersionSourceHintProps }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'font-mono inline-flex h-5 w-fit max-w-full shrink-0 items-center rounded-full border px-1.5 text-ui-xs transition-colors duration-normal',
            badge.variant === 'success'
              ? 'border-notice-success/20 bg-notice-success/20 text-notice-success-fg'
              : badge.variant === 'warning'
                ? 'border-notice-warning/20 bg-notice-warning/20 text-notice-warning-fg'
                : 'border-border1 bg-surface4 text-neutral5',
          )}
        >
          {badge.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        <VersionSourceTooltipContent {...sourceHint} />
      </TooltipContent>
    </Tooltip>
  );
}

export function AgentSidebarVersionHeader({
  agentId,
  agentVersionId,
  selectedVersionId,
  threadId = 'new',
  onCreateVersion,
  onVersionSelect,
  onBack,
  showEditorAction = true,
  showCreateVersionAction = true,
}: AgentSidebarVersionHeaderProps) {
  const [isVersionSelectOpen, setIsVersionSelectOpen] = useState(false);
  const { data: agent, isLoading } = useAgent(agentId);
  const { isCmsAvailable, isLoading: isCmsAvailabilityLoading } = useIsCmsAvailable();
  const { navigate, paths } = useLinkComponent();
  const versionsQuery = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
    enabled: Boolean(isCmsAvailable && agent && agent.editor !== false),
  });
  const hasVersions = (versionsQuery.data?.versions.length ?? 0) > 0;
  const storedAgentQuery = useStoredAgent(agentId, {
    status: 'draft',
    enabled: Boolean(isCmsAvailable && agent && agent.editor !== false && hasVersions),
  });
  const activateVersion = useActivateAgentVersion({ agentId });
  const unpublishVersion = useUnpublishAgentVersion({ agentId });

  const agentName = agent?.name || agentId;
  const versions = versionsQuery.data?.versions ?? [];
  const currentVersionId = selectedVersionId ?? agentVersionId;
  const mutationActiveVersionId =
    activateVersion.data !== undefined
      ? activateVersion.data.activeVersionId
      : unpublishVersion.data !== undefined
        ? unpublishVersion.data.activeVersionId
        : undefined;
  const storedActiveVersionId = storedAgentQuery.data ? storedAgentQuery.data.activeVersionId : undefined;
  const activeVersionId =
    mutationActiveVersionId !== undefined
      ? mutationActiveVersionId
      : storedActiveVersionId !== undefined
        ? storedActiveVersionId
        : agent?.activeVersionId;
  const activeVersion = activeVersionId ? versions.find(version => version.id === activeVersionId) : undefined;
  const activeVersionLabel = activeVersion ? `v${activeVersion.versionNumber}` : undefined;
  const selectedRouteVersion = currentVersionId ? versions.find(version => version.id === currentVersionId) : undefined;
  const selectedRouteVersionLabel = selectedRouteVersion ? `v${selectedRouteVersion.versionNumber}` : undefined;
  const isSelectedRoutePublished = Boolean(currentVersionId && currentVersionId === activeVersionId);
  const isEditorLocked = agent?.editor === false;
  const canSwitchVersions = !isCmsAvailabilityLoading && isCmsAvailable && !isEditorLocked;
  const isCheckingVersions =
    canSwitchVersions && (versionsQuery.isLoading || (hasVersions && storedAgentQuery.isLoading));
  const isCurrentThreadNew = threadId === 'new';
  const canPublishSelectedVersion = Boolean(
    currentVersionId && selectedRouteVersion && currentVersionId !== activeVersionId,
  );
  const canUnpublishVersion = Boolean(activeVersionId && (!currentVersionId || currentVersionId === activeVersionId));
  const hasInlineVersionActions = canPublishSelectedVersion || canUnpublishVersion || showEditorAction;

  const versionOptions: ComboboxOption[] = [
    {
      label: agentName,
      value: DEFAULT_AGENT_OPTION_VALUE,
      description: activeVersionLabel
        ? `Default route uses the published Editor version ${activeVersionLabel}`
        : 'Default route uses the code-defined agent',
      start: (
        <span className="flex size-4 shrink-0 items-center justify-center text-neutral4">
          <AgentIcon />
        </span>
      ),
      end: activeVersionLabel ? (
        <Badge variant="success" size="xs">
          Published {activeVersionLabel}
        </Badge>
      ) : (
        <Badge variant="default" size="xs">
          Code
        </Badge>
      ),
    },
    ...versions.map(version => {
      const isPublished = version.id === activeVersionId;
      const trimmedMessage = version.changeMessage?.trim();
      const description = [
        formatTimestamp(version.createdAt),
        trimmedMessage && trimmedMessage !== 'Auto-saved after edit' ? trimmedMessage : undefined,
      ]
        .filter(Boolean)
        .join(' - ');

      return {
        label: `v${version.versionNumber}`,
        value: version.id,
        description,
        start: <GitBranch className="size-3.5 shrink-0 text-neutral4" />,
        end: isPublished ? (
          <Badge variant="success" size="xs">
            Published
          </Badge>
        ) : undefined,
      };
    }),
  ];

  if (agentVersionId && !selectedRouteVersion) {
    versionOptions.push({
      label: 'Current version',
      value: agentVersionId,
      description: 'Version from the current route',
      start: <GitBranch className="size-3.5 shrink-0 text-neutral4" />,
    });
  }

  const handleVersionChange = (versionId: string) => {
    if (onVersionSelect) {
      onVersionSelect(versionId === DEFAULT_AGENT_OPTION_VALUE ? null : versionId);
      return;
    }

    if (versionId === DEFAULT_AGENT_OPTION_VALUE || !paths.agentVersionThreadLink) {
      navigate(isCurrentThreadNew ? paths.agentNewThreadLink(agentId) : paths.agentThreadLink(agentId, threadId));
      return;
    }

    const nextPath =
      isCurrentThreadNew && paths.agentVersionNewThreadLink
        ? paths.agentVersionNewThreadLink(agentId, versionId)
        : paths.agentVersionThreadLink(agentId, versionId, threadId);

    navigate(nextPath);
  };

  const handleCreateVersion = () => {
    setIsVersionSelectOpen(false);
    onCreateVersion();
  };

  const handlePublishSelectedVersion = async () => {
    if (!currentVersionId) return;

    try {
      await activateVersion.mutateAsync(currentVersionId);
      toast.success(`Published v${selectedRouteVersion?.versionNumber ?? ''}`.trim());
    } catch (error) {
      toast.error(`Failed to publish version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUnpublishVersion = async () => {
    try {
      await unpublishVersion.mutateAsync();
      toast.success('Unpublished version');
    } catch (error) {
      toast.error(`Failed to unpublish version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const isDataBackedVersion = Boolean(currentVersionId || activeVersionLabel);
  const triggerLabel = currentVersionId ? (selectedRouteVersionLabel ?? 'Current version') : 'Default';
  const triggerBadge = currentVersionId
    ? isSelectedRoutePublished
      ? ({ label: 'Published', variant: 'success' } satisfies VersionTriggerBadge)
      : ({ label: 'Saved', variant: 'warning' } satisfies VersionTriggerBadge)
    : activeVersionLabel
      ? ({ label: `Published ${activeVersionLabel}`, variant: 'success' } satisfies VersionTriggerBadge)
      : ({ label: 'Code', variant: 'default' } satisfies VersionTriggerBadge);
  const sourceHint = isDataBackedVersion
    ? {
        kind: 'data' as const,
        label: currentVersionId ? 'Data-backed version' : 'Default uses Editor data',
        status: currentVersionId
          ? selectedRouteVersionLabel
            ? `${isSelectedRoutePublished ? 'Published' : 'Saved'} ${selectedRouteVersionLabel}`
            : isSelectedRoutePublished
              ? 'Published version'
              : 'Exact version'
          : activeVersionLabel
            ? `Published ${activeVersionLabel}`
            : 'Published version',
      }
    : {
        kind: 'code' as const,
        label: 'Code-defined agent',
        status: 'Ships with code',
      };

  const triggerContent = (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
      {currentVersionId ? (
        <GitBranch className="size-3.5 shrink-0 text-neutral4" />
      ) : (
        <span className="flex size-4 shrink-0 items-center justify-center text-neutral4">
          <AgentIcon />
        </span>
      )}
      <Txt as="span" variant="ui-sm" className="min-w-0 flex-1 truncate font-medium text-neutral6">
        {triggerLabel}
      </Txt>
      <VersionSourceBadge badge={triggerBadge} sourceHint={sourceHint} />
    </span>
  );

  return (
    <TooltipProvider delay={0}>
      <div
        data-testid="agent-sidebar-version-header"
        className="shrink-0 border-b border-border1/50 bg-surface3 px-2 py-2"
      >
        {isLoading || isCmsAvailabilityLoading || isCheckingVersions ? (
          <div className="flex w-full items-center gap-1.5">
            {onBack ? (
              <Button type="button" size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to threads">
                <ArrowLeft className="size-3.5" />
              </Button>
            ) : null}
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border1/50 bg-surface4 px-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="ml-auto h-3 w-12" />
            </div>
          </div>
        ) : canSwitchVersions ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              {onBack ? (
                <Button type="button" size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to threads">
                  <ArrowLeft className="size-3.5" />
                </Button>
              ) : null}
              {/* No inner container: the header itself is the zone. The
                  borderless combobox fills the row as the clickable trigger and
                  the inline actions sit beside it, so nothing reads as a nested
                  box. */}
              <div className="flex min-w-0 flex-1 items-center">
                {/* Block wrapper grows to fill the row; the combobox root is a
                    flex-col, so it only stretches the trigger to full width when
                    its parent is a block box (not a flex item) that owns flex-1. */}
                <div className="min-w-0 flex-1">
                  <Combobox
                    options={versionOptions}
                    value={currentVersionId ?? DEFAULT_AGENT_OPTION_VALUE}
                    onValueChange={handleVersionChange}
                    placeholder="Versions"
                    searchPlaceholder="Search versions..."
                    emptyText="No versions found."
                    triggerAriaLabel={`Switch ${agentName} version`}
                    triggerContent={triggerContent}
                    popupFooter={
                      showCreateVersionAction ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={handleCreateVersion}
                        >
                          <Plus className="size-3.5" />
                          Create version
                        </Button>
                      ) : null
                    }
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full min-w-0 justify-between rounded-md px-2 py-1.5"
                    open={isVersionSelectOpen}
                    onOpenChange={setIsVersionSelectOpen}
                  />
                </div>
                {hasInlineVersionActions ? <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border1/50" /> : null}
                {canPublishSelectedVersion ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={handlePublishSelectedVersion}
                    disabled={activateVersion.isPending}
                    aria-label={
                      activateVersion.isPending
                        ? `Publishing v${selectedRouteVersion?.versionNumber}`
                        : `Publish v${selectedRouteVersion?.versionNumber}`
                    }
                    tooltip={
                      activateVersion.isPending
                        ? `Publishing v${selectedRouteVersion?.versionNumber}`
                        : `Publish v${selectedRouteVersion?.versionNumber}`
                    }
                  >
                    <UploadCloud className="size-3.5" />
                  </Button>
                ) : null}
                {canUnpublishVersion ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleUnpublishVersion}
                    disabled={unpublishVersion.isPending}
                    aria-label={unpublishVersion.isPending ? 'Unpublishing version' : 'Unpublish version'}
                    tooltip={unpublishVersion.isPending ? 'Unpublishing version' : 'Unpublish version'}
                  >
                    <CloudOff className="size-3.5" />
                  </Button>
                ) : null}
                {showEditorAction ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleCreateVersion}
                    aria-label="Open agent editor"
                    tooltip="Open agent editor"
                    data-testid="agent-sidebar-version-header-open-editor"
                  >
                    <Pencil />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : isEditorLocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex w-full items-center gap-1.5">
                {onBack ? (
                  <Button type="button" size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to threads">
                    <ArrowLeft className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-disabled="true"
                  aria-label="Versions unavailable"
                  className="min-w-0 flex-1 cursor-not-allowed justify-start opacity-50"
                  onClick={event => event.preventDefault()}
                >
                  <Lock className="size-3.5" />
                  Versions locked
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>This code-defined agent has disabled Studio editing with editor: false.</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex w-full items-center gap-1.5">
                {onBack ? (
                  <Button type="button" size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back to threads">
                    <ArrowLeft className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-disabled="true"
                  aria-label="Versions unavailable"
                  className="min-w-0 flex-1 cursor-not-allowed justify-start opacity-50"
                  onClick={event => event.preventDefault()}
                >
                  <Info className="size-3.5" />
                  Versions unavailable
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Configure <code>@mastra/editor</code> to create and switch agent versions. <DocsLink />
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
