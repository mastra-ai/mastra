import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
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

import { useAllAgentVersions } from '../../hooks/use-agent-versions';

type AgentVersionListItem = NonNullable<ReturnType<typeof useAllAgentVersions>['data']>['versions'][number];

export interface ProductionActivationInput {
  versionId: string;
  expectedActiveVersionId: string | null;
}

export type ProductionActivationResult =
  | { status: 'success' }
  | { status: 'conflict'; currentActiveVersionId?: string | null; message?: string }
  | { status: 'error'; message?: string };

interface ProductionIntent {
  target: AgentVersionListItem;
  expectedActiveVersionId: string | null;
  hasFreshActiveVersion: boolean;
  needsReview: boolean;
  reviewed: boolean;
  error?: string;
}

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
  canPublish: boolean;
  isPublishAccessLoading: boolean;
  isVersionHistoryError?: boolean;
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<boolean>;
  /** CAS-safe Production activation. When supplied, this replaces the legacy publish callback. */
  onActivateProduction?: (input: ProductionActivationInput) => Promise<ProductionActivationResult>;
  /** Reads the authoritative Production pointer after conflict recovery fails. */
  onRefreshProduction?: () => Promise<string | null>;
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
  canPublish,
  isPublishAccessLoading,
  isVersionHistoryError = false,
  isCodeSourceAgent = false,
  showCodeModeActions = false,
  canOpenPr = false,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onActivateProduction,
  onRefreshProduction,
  onDownloadJson,
  onOpenPr,
  isViewingPreviousVersion = false,
}: AgentPlaygroundVersionBarProps) {
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showProductionDialog, setShowProductionDialog] = useState(false);
  const [productionIntent, setProductionIntent] = useState<ProductionIntent>();
  const [isProductionSubmitting, setIsProductionSubmitting] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');
  const isUpdatingProduction = isPublishing || isProductionSubmitting;

  const { data, isError: isVersionQueryError } = useAllAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
  });
  const isVersionHistoryUnverified = isVersionHistoryError || isVersionQueryError;

  const versions = useMemo(() => data?.versions ?? [], [data?.versions]);
  const latestVersion = versions[0];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;
  const selectedVersion = selectedVersionId ? versions.find(v => v.id === selectedVersionId) : latestVersion;
  const getProductionActionLabel = useCallback(
    (target: AgentVersionListItem | undefined, observedActiveVersionId: string | null | undefined) => {
      const observedActiveVersion = observedActiveVersionId
        ? versions.find(version => version.id === observedActiveVersionId)
        : undefined;
      return observedActiveVersion && target && target.versionNumber < observedActiveVersion.versionNumber
        ? 'Roll Back Production'
        : 'Promote to Production';
    },
    [versions],
  );

  const versionOptions = useMemo(
    () =>
      versions.map(v => {
        const isProduction = v.id === activeVersionId;
        const isDraftVersion = activeVersionNumber !== undefined && v.versionNumber > activeVersionNumber;

        return {
          value: v.id,
          label: `${isCodeSourceAgent ? 'Save' : 'v'}${v.versionNumber} - ${formatTimestamp(v.createdAt)}`,
          description: v.changeMessage || undefined,
          end: isCodeSourceAgent ? (
            <Badge variant={isProduction ? 'success' : 'info'}>{isProduction ? 'Current' : 'Saved'}</Badge>
          ) : isProduction ? (
            <Badge variant="success">Production</Badge>
          ) : isDraftVersion ? (
            <Badge variant="info">Draft</Badge>
          ) : undefined,
        };
      }),
    [versions, activeVersionId, activeVersionNumber, isCodeSourceAgent],
  );

  const currentValue = selectedVersionId ?? latestVersion?.id ?? '';
  const currentVersionLabel = selectedVersion ? `v${selectedVersion.versionNumber}` : currentValue;

  const saveDisabled = readOnly || !isDirty || isSavingDraft || isPublishing || isProductionSubmitting;
  const versionInfoText = isCodeSourceAgent
    ? 'Code mode saves write override JSON to filesystem-backed editor storage. This dropdown shows saved override snapshots for this agent.'
    : 'Changes are saved as immutable versions. Moving the production pointer selects an existing version without creating a new one.';
  const productionActionDescription =
    'Moves the production pointer to this immutable version without creating a new version.';
  const productionActionLabel = getProductionActionLabel(selectedVersion, activeVersionId);
  const dialogTarget = productionIntent?.target ?? selectedVersion;
  const dialogActiveVersionId = productionIntent ? productionIntent.expectedActiveVersionId : activeVersionId;
  const dialogActiveVersion = dialogActiveVersionId
    ? versions.find(version => version.id === dialogActiveVersionId)
    : undefined;
  const dialogActionLabel = getProductionActionLabel(dialogTarget, dialogActiveVersionId);
  const currentProductionLabel = dialogActiveVersion
    ? `v${dialogActiveVersion.versionNumber}`
    : dialogActiveVersionId
      ? 'Unknown production version'
      : 'No production version';
  const targetVersionLabel =
    dialogTarget?.versionNumber === undefined ? 'Unknown version' : `v${dialogTarget.versionNumber}`;
  const targetChangeMessage = dialogTarget?.changeMessage?.trim() || 'No change message';

  const handleSaveWithMessage = useCallback(async () => {
    if (isSavingDraft) return;
    const msg = changeMessage.trim();
    await onSaveDraft(msg || undefined);
    setShowMessageDialog(false);
    setChangeMessage('');
  }, [changeMessage, onSaveDraft, isSavingDraft]);

  const openProductionDialog = useCallback(() => {
    if (!selectedVersion || isVersionHistoryUnverified) return;
    setProductionIntent({
      target: selectedVersion,
      expectedActiveVersionId: activeVersionId ?? null,
      hasFreshActiveVersion: true,
      needsReview: false,
      reviewed: false,
    });
    setShowProductionDialog(true);
  }, [activeVersionId, isVersionHistoryUnverified, selectedVersion]);

  const closeProductionDialog = useCallback(() => {
    setShowProductionDialog(false);
    setProductionIntent(undefined);
  }, []);

  const handleProductionDialogChange = useCallback(
    (open: boolean) => {
      if (!open && isUpdatingProduction) return;
      setShowProductionDialog(open);
      if (!open) setProductionIntent(undefined);
    },
    [isUpdatingProduction],
  );

  const handleProductionConfirm = useCallback(async () => {
    if (isPublishing || isProductionSubmitting || isVersionHistoryUnverified || !productionIntent) return;
    setIsProductionSubmitting(true);
    setProductionIntent(intent => (intent ? { ...intent, error: undefined } : intent));
    try {
      if (!onActivateProduction) {
        const succeeded = await onPublish();
        if (succeeded) closeProductionDialog();
        return;
      }

      const result = await onActivateProduction({
        versionId: productionIntent.target.id,
        expectedActiveVersionId: productionIntent.expectedActiveVersionId,
      });
      if (result.status === 'success') {
        closeProductionDialog();
        return;
      }
      if (result.status === 'conflict') {
        const hasFreshActiveVersion = result.currentActiveVersionId !== undefined;
        setProductionIntent(intent =>
          intent
            ? {
                ...intent,
                expectedActiveVersionId: hasFreshActiveVersion
                  ? (result.currentActiveVersionId ?? null)
                  : intent.expectedActiveVersionId,
                hasFreshActiveVersion,
                needsReview: true,
                reviewed: false,
                error: result.message,
              }
            : intent,
        );
        return;
      }
      setProductionIntent(intent =>
        intent ? { ...intent, error: result.message ?? 'Couldn’t update Production.' } : intent,
      );
    } catch (error) {
      setProductionIntent(intent =>
        intent ? { ...intent, error: error instanceof Error ? error.message : 'Couldn’t update Production.' } : intent,
      );
    } finally {
      setIsProductionSubmitting(false);
    }
  }, [
    closeProductionDialog,
    isProductionSubmitting,
    isPublishing,
    isVersionHistoryUnverified,
    onActivateProduction,
    onPublish,
    productionIntent,
  ]);

  const handleRefreshProduction = useCallback(async () => {
    if (!onRefreshProduction) return;
    setIsProductionSubmitting(true);
    try {
      const currentActiveVersionId = await onRefreshProduction();
      setProductionIntent(intent =>
        intent
          ? {
              ...intent,
              expectedActiveVersionId: currentActiveVersionId,
              hasFreshActiveVersion: true,
              reviewed: false,
              error: undefined,
            }
          : intent,
      );
    } catch (error) {
      setProductionIntent(intent =>
        intent
          ? {
              ...intent,
              hasFreshActiveVersion: false,
              reviewed: false,
              error: error instanceof Error ? error.message : 'Couldn’t refresh Production.',
            }
          : intent,
      );
    } finally {
      setIsProductionSubmitting(false);
    }
  }, [onRefreshProduction]);

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

        {currentValue && (
          <CopyButton content={currentValue} tooltip={`Copy preview version ID for ${currentVersionLabel}`} size="sm" />
        )}

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

            {!isPublishAccessLoading && canPublish ? (
              <Button
                variant="primary"
                size="md"
                onClick={openProductionDialog}
                title={
                  isVersionHistoryUnverified
                    ? 'Version history could not be verified. Retry before moving Production.'
                    : productionActionDescription
                }
                disabled={
                  isVersionHistoryUnverified ||
                  !selectedVersion ||
                  (isViewingPreviousVersion
                    ? selectedVersionId === activeVersionId || isUpdatingProduction || isSavingDraft
                    : readOnly || !hasDraft || isUpdatingProduction || isSavingDraft)
                }
              >
                {isUpdatingProduction ? (
                  <>
                    <Spinner className="size-3.5" />
                    Updating production&hellip;
                  </>
                ) : (
                  <>
                    <Icon size="sm">
                      <Check />
                    </Icon>
                    {productionActionLabel}
                  </>
                )}
              </Button>
            ) : null}
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

        <AlertDialog open={showProductionDialog} onOpenChange={handleProductionDialogChange}>
          <AlertDialog.Content aria-busy={isUpdatingProduction}>
            <AlertDialog.Header>
              <AlertDialog.Title>{dialogActionLabel}?</AlertDialog.Title>
              <AlertDialog.Description>
                This moves the production pointer to an existing immutable version. It does not create a new version.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <dl className="text-ui-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-neutral3">Current production</dt>
                <dd className="text-neutral5">{currentProductionLabel}</dd>
                <dt className="text-neutral3">Target version</dt>
                <dd className="text-neutral5">{targetVersionLabel}</dd>
                <dt className="text-neutral3">Change message</dt>
                <dd className="text-neutral5">{targetChangeMessage}</dd>
              </dl>
              {productionIntent?.needsReview ? (
                <div
                  className="border-border1 bg-surface3 mt-4 flex flex-col gap-2 rounded-lg border p-3"
                  role="status"
                >
                  <Txt variant="ui-sm">
                    {productionIntent.hasFreshActiveVersion
                      ? `Production changed while this dialog was open. It now points to ${currentProductionLabel}.`
                      : 'Production changed while this dialog was open, but its current target could not be refreshed.'}
                  </Txt>
                  {productionIntent.hasFreshActiveVersion ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      aria-label={`Review current Production before moving to ${targetVersionLabel}`}
                      onClick={() => setProductionIntent(intent => (intent ? { ...intent, reviewed: true } : intent))}
                      disabled={productionIntent.reviewed || isUpdatingProduction}
                    >
                      {productionIntent.reviewed ? 'Current state reviewed' : 'Review current state'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      aria-label={`Refresh current Production before moving to ${targetVersionLabel}`}
                      onClick={() => void handleRefreshProduction()}
                      disabled={!onRefreshProduction || isUpdatingProduction}
                    >
                      Refresh current state
                    </Button>
                  )}
                </div>
              ) : null}
              {productionIntent?.error ? (
                <Txt variant="ui-sm" className="text-accent2 mt-3" role="alert">
                  {productionIntent.error}
                </Txt>
              ) : null}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <AlertDialog.Cancel disabled={isUpdatingProduction}>Cancel</AlertDialog.Cancel>
              <Button
                variant="primary"
                size="lg"
                aria-label={
                  productionIntent?.needsReview
                    ? `Try again: ${dialogActionLabel} ${targetVersionLabel}`
                    : `${dialogActionLabel} ${targetVersionLabel}`
                }
                onClick={() => void handleProductionConfirm()}
                disabled={
                  isUpdatingProduction ||
                  isPublishAccessLoading ||
                  isVersionHistoryUnverified ||
                  !canPublish ||
                  Boolean(
                    productionIntent?.needsReview &&
                    (!productionIntent.hasFreshActiveVersion || !productionIntent.reviewed),
                  ) ||
                  productionIntent?.target.id === productionIntent?.expectedActiveVersionId
                }
              >
                {isUpdatingProduction ? (
                  <>
                    <Spinner className="size-3.5" />
                    Updating production&hellip;
                  </>
                ) : productionIntent?.needsReview ? (
                  'Try again'
                ) : (
                  dialogActionLabel
                )}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog>
      </div>
    ),
  };
}
