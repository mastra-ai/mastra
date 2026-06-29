import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { HoverPopover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, ChevronDown, Clock, Download, GitPullRequest, Info, MessageSquare, Save } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useAgentVersions } from '../../hooks/use-agent-versions';

interface AgentPlaygroundVersionBarProps {
  agentId: string;
  activeVersionId?: string;
  selectedVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  isDirty: boolean;
  isSavingDraft: boolean;
  isPublishing: boolean;
  hasDraft: boolean;
  readOnly: boolean;
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onDownloadJson?: () => Promise<void>;
  onOpenPr?: () => Promise<void>;
  /** Whether the user is viewing a previous (non-latest) version that can be published */
  isViewingPreviousVersion?: boolean;
  layout?: 'default' | 'panel';
}

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

export function AgentPlaygroundVersionBar({
  agentId,
  activeVersionId,
  selectedVersionId,
  onVersionSelect,
  isDirty,
  isSavingDraft,
  isPublishing,
  hasDraft,
  readOnly,
  isCodeSourceAgent = false,
  showCodeModeActions = false,
  canOpenPr = false,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onDownloadJson,
  onOpenPr,
  isViewingPreviousVersion = false,
  layout = 'default',
}: AgentPlaygroundVersionBarProps) {
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');
  const isPanel = layout === 'panel';

  const { data } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
  });

  const versions = useMemo(() => data?.versions ?? [], [data?.versions]);
  const latestVersion = versions[0];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;

  const versionOptions = useMemo(
    () =>
      versions.map(v => {
        const isPublished = v.id === activeVersionId;
        const isDraftVersion = activeVersionNumber !== undefined && v.versionNumber > activeVersionNumber;

        return {
          value: v.id,
          label: `${isCodeSourceAgent ? 'Save' : 'v'}${v.versionNumber} - ${formatTimestamp(v.createdAt)}`,
          description: v.changeMessage || undefined,
          end: isCodeSourceAgent ? (
            <Badge variant={isPublished ? 'success' : 'info'}>{isPublished ? 'Current' : 'Saved'}</Badge>
          ) : isPublished ? (
            <Badge variant="success">Published</Badge>
          ) : isDraftVersion ? (
            <Badge variant="info">Draft</Badge>
          ) : undefined,
        };
      }),
    [versions, activeVersionId, activeVersionNumber, isCodeSourceAgent],
  );

  const currentValue = selectedVersionId ?? latestVersion?.id ?? '';

  const saveDisabled = readOnly || !isDirty || isSavingDraft || isPublishing;
  const versionInfoText = isCodeSourceAgent
    ? 'Code mode saves write override JSON to filesystem-backed editor storage. This dropdown shows saved override snapshots for this agent.'
    : "Changes are saved as draft versions. When you're ready, publish a version to make it the active configuration used in production.";

  const handleSaveWithMessage = useCallback(async () => {
    if (isSavingDraft) return;
    const msg = changeMessage.trim();
    await onSaveDraft(msg || undefined);
    setShowMessageDialog(false);
    setChangeMessage('');
  }, [changeMessage, onSaveDraft, isSavingDraft]);

  const publishDisabled = isViewingPreviousVersion
    ? selectedVersionId === activeVersionId || isPublishing || isSavingDraft
    : readOnly || !hasDraft || isPublishing || isSavingDraft;

  const saveButtonContent = isSavingDraft ? (
    <>
      <Spinner className="size-3.5" />
      Saving&hellip;
    </>
  ) : (
    <>
      <Icon size="sm">
        <Save />
      </Icon>
      Save New Version
    </>
  );

  const publishButtonContent = isPublishing ? (
    <>
      <Spinner className="size-3.5" />
      Publishing&hellip;
    </>
  ) : (
    <>
      <Icon size="sm">
        <Check />
      </Icon>
      {isViewingPreviousVersion ? 'Publish This Version' : 'Publish'}
    </>
  );

  const versionSelector = (
    <div
      className={cn('flex items-center gap-2 border-b border-border1 bg-surface3', isPanel ? 'px-3 py-2' : 'px-4 py-3')}
    >
      <Icon size="sm" className="shrink-0 text-neutral3">
        <Clock />
      </Icon>

      {versions.length > 0 ? (
        <Combobox
          options={versionOptions}
          value={currentValue}
          onValueChange={onVersionSelect}
          placeholder="Select version..."
          variant="ghost"
          size={isPanel ? 'sm' : undefined}
          className="min-w-0 flex-1"
        />
      ) : (
        <Txt variant="ui-xs" className="min-w-0 flex-1 truncate text-neutral3">
          {isCodeSourceAgent ? 'No filesystem saves yet' : 'No versions yet'}
        </Txt>
      )}

      {currentValue && <CopyButton content={currentValue} tooltip="Copy version ID" size="sm" />}

      <HoverPopover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Version information">
            <Info />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56">
          <Txt variant="ui-sm" className="text-neutral3">
            {versionInfoText}
          </Txt>
        </PopoverContent>
      </HoverPopover>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {readOnly && <Badge variant="warning">Read-only</Badge>}
        {!readOnly && hasDraft && !isCodeSourceAgent && <Badge variant="info">Unpublished</Badge>}
      </div>
    </div>
  );

  let actionContent: ReactNode = null;

  if (showCodeModeActions) {
    actionContent = isPanel ? (
      <div className="grid gap-2">
        <Button className="w-full" variant="default" size="sm" onClick={() => void onDownloadJson?.()}>
          <Icon size="sm">
            <Download />
          </Icon>
          Download JSON
        </Button>
        {canOpenPr ? (
          <Button className="w-full" variant="primary" size="sm" onClick={() => void onOpenPr?.()} title={openPrTitle}>
            <Icon size="sm">
              <GitPullRequest />
            </Icon>
            Open PR
          </Button>
        ) : (
          <Button
            className="w-full"
            variant="primary"
            size="sm"
            onClick={() => void onSaveDraft()}
            disabled={saveDisabled}
          >
            {isSavingDraft ? (
              <>
                <Spinner className="size-3.5" />
                Saving&hellip;
              </>
            ) : (
              <>
                <Icon size="sm">
                  <Save />
                </Icon>
                Save to filesystem
              </>
            )}
          </Button>
        )}
      </div>
    ) : (
      <ButtonsGroup className="flex-wrap justify-end">
        <Button variant="default" size="md" onClick={() => void onDownloadJson?.()}>
          <Icon size="sm">
            <Download />
          </Icon>
          Download JSON
        </Button>
        {canOpenPr ? (
          <Button variant="primary" size="md" onClick={() => void onOpenPr?.()} title={openPrTitle}>
            <Icon size="sm">
              <GitPullRequest />
            </Icon>
            Open PR
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={() => void onSaveDraft()} disabled={saveDisabled}>
            {isSavingDraft ? (
              <>
                <Spinner className="size-3.5" />
                Saving&hellip;
              </>
            ) : (
              <>
                <Icon size="sm">
                  <Save />
                </Icon>
                Save to filesystem
              </>
            )}
          </Button>
        )}
      </ButtonsGroup>
    );
  } else if (!readOnly || isViewingPreviousVersion) {
    const saveGroup = (
      <ButtonsGroup spacing="close" className={isPanel ? 'w-full' : undefined}>
        <Button
          className={isPanel ? 'flex-1' : undefined}
          variant="default"
          size={isPanel ? 'sm' : 'md'}
          onClick={() => onSaveDraft()}
          disabled={saveDisabled}
        >
          {saveButtonContent}
        </Button>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="default"
              size={isPanel ? 'sm' : 'md'}
              disabled={saveDisabled}
              aria-label="More save options"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onSelect={() => setShowMessageDialog(true)}>
              <Icon size="sm">
                <MessageSquare />
              </Icon>
              Save with message
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </ButtonsGroup>
    );

    const publishButton = (
      <Button
        className={isPanel ? 'w-full' : undefined}
        variant="primary"
        size={isPanel ? 'sm' : 'md'}
        onClick={onPublish}
        disabled={publishDisabled}
      >
        {publishButtonContent}
      </Button>
    );

    actionContent = isPanel ? (
      <div className="grid gap-2">
        {saveGroup}
        {publishButton}
      </div>
    ) : (
      <ButtonsGroup className="flex-wrap justify-end">
        {saveGroup}
        {publishButton}
      </ButtonsGroup>
    );
  }

  const actionBar = actionContent ? (
    <div className={cn('shrink-0 border-t border-border1 bg-surface3', isPanel ? 'p-3' : 'px-3 py-2')}>
      {actionContent}
    </div>
  ) : null;

  return {
    versionSelector,
    actionBar: (
      <>
        {actionBar}
        <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save New Version</DialogTitle>
              <DialogDescription>Add a message to describe the changes in this version.</DialogDescription>
            </DialogHeader>
            <DialogBody className="py-1">
              <div className="grid gap-2">
                <Label htmlFor="change-message">Change message</Label>
                <Input
                  id="change-message"
                  placeholder="Describe what changed..."
                  value={changeMessage}
                  className="focus:ring-white/50"
                  onChange={e => setChangeMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      void handleSaveWithMessage();
                    }
                  }}
                  disabled={isSavingDraft}
                  autoFocus
                />
              </div>
            </DialogBody>
            <DialogFooter className="px-6">
              <Button variant="default" size="sm" onClick={() => setShowMessageDialog(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveWithMessage} disabled={isSavingDraft}>
                <Icon size="sm">
                  <Save />
                </Icon>
                Save Version
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    ),
  };
}
