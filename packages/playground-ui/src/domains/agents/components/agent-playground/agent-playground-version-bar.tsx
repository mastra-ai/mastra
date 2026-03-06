import { Check, ChevronDown, Clock, MessageSquare, Save } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Spinner } from '@/ds/components/Spinner';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { Combobox } from '@/ds/components/Combobox';
import { Input } from '@/ds/components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/ds/components/Dialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Label } from '@/ds/components/Label';
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

  const displayedVersion = selectedVersionId
    ? versions.find(v => v.id === selectedVersionId)
    : latestVersion;

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
    const msg = changeMessage.trim();
    setShowMessageDialog(false);
    setChangeMessage('');
    await onSaveDraft(msg || undefined);
  }, [changeMessage, onSaveDraft]);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border1 bg-surface1">
      <div className="flex items-center gap-3">
        <Icon size="sm" className="text-neutral3">
          <Clock />
        </Icon>

        {versions.length > 0 ? (
          <Combobox
            options={versionOptions}
            value={currentValue}
            onValueChange={onVersionSelect}
            placeholder="Select version..."
            variant="ghost"
            className="w-[260px]"
          />
        ) : (
          <Txt variant="ui-xs" className="text-neutral3">
            No versions yet
          </Txt>
        )}

        {displayedVersion && (
          <Txt variant="ui-xs" className="text-neutral2">
            {formatTimestamp(displayedVersion.createdAt)}
          </Txt>
        )}

        {readOnly && <Badge variant="warning">Read-only (previous version)</Badge>}
        {!readOnly && hasDraft && <Badge variant="info">Unpublished changes</Badge>}
      </div>

      <div className="flex items-center gap-2">
        {/* Split button: Save + dropdown caret */}
        <div className="flex items-center">
          <Button
            variant="default"
            size="sm"
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
                size="sm"
                disabled={saveDisabled}
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
                Save new version with message
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onPublish}
          disabled={readOnly || (!hasDraft && !isDirty) || isPublishing || isSavingDraft}
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
              Publish
            </>
          )}
        </Button>
      </div>

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
                    handleSaveWithMessage();
                  }
                }}
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter className="px-6">
            <Button variant="default" size="sm" onClick={() => setShowMessageDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveWithMessage}>
              <Icon size="sm">
                <Save />
              </Icon>
              Save Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
