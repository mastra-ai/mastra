import {
  Badge,
  Button,
  Combobox,
  CopyButton,
  DropdownMenu,
  Input,
  Label,
  HoverPopover,
  PopoverTrigger,
  PopoverContent,
  Spinner,
  Txt,
  Icon,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@mastra/playground-ui';
import { Check, ChevronDown, Clock, Info, MessageSquare, Save } from 'lucide-react';
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
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
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
  onSaveDraft,
  onPublish,
  isViewingPreviousVersion = false,
}: AgentPlaygroundVersionBarProps) {
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');

  const { data } = useAgentVersions({
    agentId,
    params: { sortDirection: 'DESC' },
  });

  const versions = data?.versions ?? [];
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
          label: `v${v.versionNumber} - ${formatTimestamp(v.createdAt)}`,
          description: v.changeMessage || undefined,
          end: isPublished ? (
            <Badge variant="success">Published</Badge>
          ) : isDraftVersion ? (
            <Badge variant="info">Draft</Badge>
          ) : undefined,
        };
      }),
    [versions, activeVersionId, activeVersionNumber],
  );

  const currentValue = selectedVersionId ?? latestVersion?.id ?? '';

  const saveDisabled = readOnly || !isDirty || isSavingDraft || isPublishing;

  const handleSaveWithMessage = useCallback(async () => {
    if (isSavingDraft) return;
    const msg = changeMessage.trim();
    await onSaveDraft(msg || undefined);
    setShowMessageDialog(false);
    setChangeMessage('');
  }, [changeMessage, onSaveDraft, isSavingDraft]);

  return {
    versionSelector: (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border1 bg-surface2">
        <Icon size="sm" className="text-neutral3 shrink-0">
          <Clock />
        </Icon>

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
            No versions yet
          </Txt>
        )}

        {currentValue && <CopyButton content={currentValue} tooltip="Copy version ID" size="sm" />}

        <HoverPopover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Version information"
              className="text-neutral3 hover:text-neutral5 transition-colors shrink-0 rounded-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <Icon size="sm">
                <Info />
              </Icon>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48">
            <Txt variant="ui-sm" className="text-neutral3">
              Changes are saved as draft versions. When you're ready, publish a version to make it the active
              configuration used in production.
            </Txt>
          </PopoverContent>
        </HoverPopover>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {readOnly && <Badge variant="warning">Read-only</Badge>}
          {!readOnly && hasDraft && <Badge variant="info">Unpublished</Badge>}
        </div>
      </div>
    ),
    actionBar: (
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border1 bg-surface2">
        {/* Split button: Save + dropdown caret */}
        <div className="flex items-center">
          <Button
            variant="default"
            size="md"
            onClick={() => onSaveDraft()}
            disabled={saveDisabled}
            className="rounded-r-none border-r-0"
          >
            {isSavingDraft ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                Saving...
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
              <Button
                variant="default"
                size="md"
                disabled={saveDisabled}
                aria-label="More save options"
                className="rounded-l-none px-1.5"
              >
                <ChevronDown className="h-3.5 w-3.5" />
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
        </div>

        <Button
          variant="cta"
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
              <Spinner className="h-3.5 w-3.5" />
              Publishing...
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
