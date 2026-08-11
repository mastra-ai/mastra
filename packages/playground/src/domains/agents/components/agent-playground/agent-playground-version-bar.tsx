import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check, ChevronDown, Download, GitPullRequest, Info, MessageSquare, Save } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';

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
}: AgentPlaygroundVersionBarProps) {
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');

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

  return {
    versionSelector: (
      <div className="border-border1 bg-surface3 flex items-center gap-2 border-b px-4 py-3">
        {versions.length > 0 ? (
          <Combobox
            options={versionOptions}
            value={currentValue}
            onValueChange={onVersionSelect}
            placeholder="Select version..."
            variant="ghost"
            className="min-w-0 flex-1"
          />
        ) : (
          <Txt variant="ui-xs" className="text-neutral3">
            {isCodeSourceAgent ? 'No filesystem saves yet' : 'No versions yet'}
          </Txt>
        )}

        {currentValue && <CopyButton content={currentValue} tooltip="Copy version ID" size="sm" />}

        <Tooltip>
          <TooltipTrigger
            aria-label="Version information"
            className="text-neutral3 hover:text-neutral5 shrink-0 rounded-sm transition-colors focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:outline-hidden"
          >
            <Icon size="sm">
              <Info />
            </Icon>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-56">
            {versionInfoText}
          </TooltipContent>
        </Tooltip>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {readOnly && <Badge variant="warning">Read-only</Badge>}
          {!readOnly && hasDraft && !isCodeSourceAgent && <Badge variant="info">Unpublished</Badge>}
        </div>
      </div>
    ),
    actionBar: (
      <div className="border-border1 bg-surface3 flex items-center justify-end border-t px-3 py-2">
        {showCodeModeActions ? (
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
        ) : readOnly && !isViewingPreviousVersion ? null : (
          <ButtonsGroup className="flex-wrap justify-end">
            <ButtonsGroup spacing="close">
              <Button variant="default" size="md" onClick={() => onSaveDraft()} disabled={saveDisabled}>
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
                    Save New Version
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="default" size="md" disabled={saveDisabled} aria-label="More save options">
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

            <Button
              variant="primary"
              size="md"
              onClick={onPublish}
              disabled={
                isViewingPreviousVersion
                  ? selectedVersionId === activeVersionId || isPublishing || isSavingDraft
                  : readOnly || !hasDraft || isPublishing || isSavingDraft
              }
            >
              {isPublishing ? (
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
              )}
            </Button>
          </ButtonsGroup>
        )}

        {/* Change message dialog */}
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
      </div>
    ),
  };
}
