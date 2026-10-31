import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { InfoTooltip } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useAgentVersions } from '@mastra/react/hooks/agents';
import { Check, ChevronDown, Download, GitPullRequest, MessageSquare, Save } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';

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
    queryOptions: { enabled: Boolean(agentId) },
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
          label: `${isCodeSourceAgent ? 'Save' : 'v'}${v.versionNumber} - ${formatDate(v.createdAt, 'date-time') ?? ''}`,
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
  const codeSaveDisabled = readOnly || (!isDirty && !hasDraft) || isSavingDraft || isPublishing;
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
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
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
          <Txt variant="meta" tone="muted">
            {isCodeSourceAgent ? 'No filesystem saves yet' : 'No versions yet'}
          </Txt>
        )}

        {currentValue && <CopyButton content={currentValue} tooltip="Copy version ID" />}

        <InfoTooltip aria-label="Version information" side="bottom" align="start" contentClassName="max-w-56">
          {versionInfoText}
        </InfoTooltip>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {readOnly && <Badge variant="warning">Read-only</Badge>}
          {!readOnly && hasDraft && !isCodeSourceAgent && <Badge variant="info">Unpublished</Badge>}
        </div>
      </div>
    ),
    actionBar: (
      <div className="flex items-center justify-end border-t border-border bg-card px-3 py-2">
        {showCodeModeActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="default" size="md" onClick={() => void onDownloadJson?.()} icon={<Download />}>
              Download JSON
            </Button>
            {canOpenPr ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => void onOpenPr?.()}
                title={openPrTitle}
                icon={<GitPullRequest />}
              >
                Open PR
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => void (isDirty ? onSaveDraft() : onPublish())}
                disabled={codeSaveDisabled}
              >
                {isSavingDraft ? (
                  <>
                    <Spinner className="size-3.5" />
                    Saving&hellip;
                  </>
                ) : (
                  <>
                    <Icon size="xs">
                      <Save />
                    </Icon>
                    Save to filesystem
                  </>
                )}
              </Button>
            )}
          </div>
        ) : readOnly && !isViewingPreviousVersion ? null : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ButtonsGroup>
              <Button variant="default" onClick={() => onSaveDraft()} disabled={saveDisabled}>
                {isSavingDraft ? (
                  <>
                    <Spinner className="size-3.5" />
                    Saving&hellip;
                  </>
                ) : (
                  <>
                    <Icon size="xs">
                      <Save />
                    </Icon>
                    Save new version
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button size="icon-md" variant="default" disabled={saveDisabled} aria-label="More save options">
                    <ChevronDown />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item onSelect={() => setShowMessageDialog(true)}>
                    <Icon size="xs">
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
                  <Icon size="xs">
                    <Check />
                  </Icon>
                  {isViewingPreviousVersion ? 'Publish this version' : 'Publish'}
                </>
              )}
            </Button>
          </div>
        )}

        <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog} pending={isSavingDraft}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save New Version</DialogTitle>
              <DialogDescription>Add a message to describe the changes in this version.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field>
                <FieldLabel>Change message</FieldLabel>
                <Input
                  placeholder="Describe what changed..."
                  value={changeMessage}
                  onChange={e => setChangeMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      void handleSaveWithMessage();
                    }
                  }}
                  disabled={isSavingDraft}
                  autoFocus
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction onConfirm={handleSaveWithMessage}>Save version</DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    ),
  };
}
