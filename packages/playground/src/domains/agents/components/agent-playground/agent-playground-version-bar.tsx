import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { controlStateColorTransition, focusRing } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { Check, ChevronDown, Download, GitPullRequest, Info, MessageSquare, Save } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';

import type { AgentVersionLabelErrorCode } from '../../hooks/agent-version-label-error';
import type { AgentVersionIntegrityRecovery } from '../../hooks/use-agent-version-mutation-integrity';
import { useAllAgentVersions } from '../../hooks/use-agent-versions';
import type { AgentVersionLabelRefreshOptions } from '../agent-version-label-dialogs';
import { AgentVersionLabelManager } from '../agent-version-label-manager';

type AgentVersionListItem = NonNullable<ReturnType<typeof useAllAgentVersions>['data']>['versions'][number];

export interface ProductionActivationInput {
  versionId: string;
  expectedActiveVersionId: string | null;
}

export type ProductionActivationResult =
  | { status: 'success' }
  | { status: 'conflict'; currentActiveVersionId?: string | null; message?: string }
  | { status: 'error'; code?: AgentVersionLabelErrorCode; message?: string };

interface ProductionIntent {
  target: AgentVersionListItem;
  expectedActiveVersionId: string | null;
  hasFreshActiveVersion: boolean;
  needsReview: boolean;
  reviewed: boolean;
  isTargetRejected: boolean;
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
  isPublishAccessError?: boolean;
  isVersionHistoryError?: boolean;
  isProductionStateError?: boolean;
  isProductionStateFetching?: boolean;
  onRetryProductionState?: () => Promise<void>;
  integrityRecovery?: AgentVersionIntegrityRecovery;
  isSourceProviderBacked?: boolean;
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
  isPublishAccessError = false,
  isVersionHistoryError = false,
  isProductionStateError = false,
  isProductionStateFetching = false,
  onRetryProductionState,
  integrityRecovery,
  isSourceProviderBacked = false,
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

  const {
    data,
    isLoading: isVersionHistoryLoading,
    isError: isVersionQueryError,
    refetch: refetchVersions,
  } = useAllAgentVersions(
    {
      agentId,
      params: { orderBy: { direction: 'DESC' } },
    },
    useEntityRequestContext('agent', agentId!)[0],
  );
  const isVersionHistoryUnverified = isVersionHistoryError || isVersionQueryError;
  const isProductionMutationBlocked =
    isProductionStateError || isProductionStateFetching || Boolean(integrityRecovery?.isBlocked);

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
          label: `${isCodeSourceAgent ? 'Save' : 'v'}${v.versionNumber} - ${formatDate(v.createdAt, 'date-time') ?? ''}`,
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
  const currentProductionLabel = isProductionStateError
    ? 'Unknown — retry required'
    : dialogActiveVersion
      ? `v${dialogActiveVersion.versionNumber}`
      : dialogActiveVersionId
        ? 'Unknown production version'
        : 'No production version';
  const targetVersionLabel =
    dialogTarget?.versionNumber === undefined ? 'Unknown version' : `v${dialogTarget.versionNumber}`;
  const targetChangeMessage = dialogTarget?.changeMessage?.trim() || 'No change message';
  const isDialogTargetAvailable = Boolean(dialogTarget && versions.some(version => version.id === dialogTarget.id));
  const isDialogTargetUsable = isDialogTargetAvailable && !productionIntent?.isTargetRejected;

  const handleSaveWithMessage = useCallback(async () => {
    if (isSavingDraft) return;
    const msg = changeMessage.trim();
    await onSaveDraft(msg || undefined);
    setShowMessageDialog(false);
    setChangeMessage('');
  }, [changeMessage, onSaveDraft, isSavingDraft]);

  const handleRetryProductionState = useCallback(() => {
    if (!onRetryProductionState) return;
    void onRetryProductionState().catch(() => undefined);
  }, [onRetryProductionState]);

  const handleRefreshVersions = useCallback(
    async (options?: AgentVersionLabelRefreshOptions): Promise<string | null> => {
      const result = await refetchVersions({ throwOnError: options?.throwOnError });
      return result.data?.versions.find(version => version.labels?.includes('production'))?.id ?? null;
    },
    [refetchVersions],
  );

  const openProductionDialog = useCallback(() => {
    if (!selectedVersion || isVersionHistoryUnverified || isProductionMutationBlocked) return;
    setProductionIntent({
      target: selectedVersion,
      expectedActiveVersionId: activeVersionId ?? null,
      hasFreshActiveVersion: true,
      needsReview: false,
      reviewed: false,
      isTargetRejected: false,
    });
    setShowProductionDialog(true);
  }, [activeVersionId, isProductionMutationBlocked, isVersionHistoryUnverified, selectedVersion]);

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
    if (
      isPublishing ||
      isProductionSubmitting ||
      isVersionHistoryUnverified ||
      isProductionMutationBlocked ||
      !productionIntent ||
      !isDialogTargetUsable
    )
      return;
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
        intent
          ? {
              ...intent,
              isTargetRejected: result.code === 'VERSION_NOT_FOUND' || intent.isTargetRejected,
              error: result.message ?? 'Couldn’t update Production.',
            }
          : intent,
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
    isProductionMutationBlocked,
    isVersionHistoryUnverified,
    isDialogTargetUsable,
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
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
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

        {currentValue && (
          <CopyButton content={currentValue} tooltip={`Copy preview version ID for ${currentVersionLabel}`} size="sm" />
        )}

        <Tooltip>
          <TooltipTrigger
            aria-label="Version information"
            className={cn('shrink-0 rounded-sm', focusRing, quietTextHover, controlStateColorTransition)}
          >
            <Icon size="xs">
              <Info />
            </Icon>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-56">
            {versionInfoText}
          </TooltipContent>
        </Tooltip>

        <AgentVersionLabelManager
          agentId={agentId}
          versions={versions}
          activeVersionId={activeVersionId}
          isSourceProviderBacked={isSourceProviderBacked}
          canPublish={canPublish}
          isPublishPermissionLoading={isPublishAccessLoading}
          isPublishPermissionError={isPublishAccessError}
          isVersionHistoryLoading={isVersionHistoryLoading}
          isVersionHistoryError={isVersionHistoryUnverified}
          isProductionStateError={isProductionStateError}
          isProductionStateFetching={isProductionStateFetching}
          onRetryProductionState={onRetryProductionState}
          integrityRecovery={integrityRecovery}
          onRefreshVersions={handleRefreshVersions}
        />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {readOnly && <Badge variant="warning">Read-only</Badge>}
          {!readOnly && hasDraft && !isCodeSourceAgent && <Badge variant="info">Unpublished</Badge>}
        </div>
      </div>
    ),
    actionBar: (
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-3 py-2">
        {isProductionStateError ? (
          <div className="mr-auto flex flex-wrap items-center gap-2" role="alert">
            <Txt variant="meta" className="text-warning-bright">
              Production state is unknown. Retry before moving the pointer.
            </Txt>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleRetryProductionState}
              disabled={!onRetryProductionState || isProductionStateFetching}
            >
              {isProductionStateFetching ? 'Retrying Production state…' : 'Retry Production state'}
            </Button>
          </div>
        ) : isProductionStateFetching ? (
          <Txt variant="meta" tone="muted" className="mr-auto" role="status">
            Refreshing Production state&hellip;
          </Txt>
        ) : null}
        {integrityRecovery?.isBlocked ? (
          <div className="mr-auto flex flex-wrap items-center gap-2" role="alert">
            <div>
              <Txt variant="meta" className="text-warning-bright">
                Version-label integrity could not be verified. Production stays disabled until state is refreshed.
              </Txt>
              {integrityRecovery.error ? (
                <Txt variant="meta" className="text-destructive-bright">
                  {integrityRecovery.error}
                </Txt>
              ) : null}
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={integrityRecovery.onRetry}
              disabled={integrityRecovery.isRetrying}
            >
              {integrityRecovery.isRetrying ? 'Retrying version-label state…' : 'Retry version-label state'}
            </Button>
          </div>
        ) : null}
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
              <Button variant="primary" size="md" onClick={() => void onSaveDraft()} disabled={saveDisabled}>
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
                    Save New Version
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="default" disabled={saveDisabled} aria-label="More save options">
                    <ChevronDown className="size-3.5" />
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

            {!isPublishAccessLoading && canPublish ? (
              <Button
                variant="primary"
                size="md"
                aria-label={`${productionActionLabel} ${currentVersionLabel}`}
                onClick={openProductionDialog}
                title={
                  isVersionHistoryUnverified
                    ? 'Version history could not be verified. Retry before moving Production.'
                    : isProductionStateError
                      ? 'Production state could not be verified. Retry before moving Production.'
                      : integrityRecovery?.isBlocked
                        ? 'Version-label integrity could not be verified. Retry before moving Production.'
                        : productionActionDescription
                }
                disabled={
                  isVersionHistoryUnverified ||
                  isProductionMutationBlocked ||
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
              <DialogAction onConfirm={handleSaveWithMessage}>Save Version</DialogAction>
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
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-caption">
                <dt className="text-muted-foreground">Current production</dt>
                <dd className="text-foreground">{currentProductionLabel}</dd>
                <dt className="text-muted-foreground">Target version</dt>
                <dd className="text-foreground">{targetVersionLabel}</dd>
                <dt className="text-muted-foreground">Change message</dt>
                <dd className="text-foreground">{targetChangeMessage}</dd>
              </dl>
              {productionIntent && !isDialogTargetUsable ? (
                <div className="mt-4 rounded-lg border border-border bg-card p-3" role="alert">
                  <Txt variant="caption">
                    The selected target version is no longer available. Choose a current version and reopen this
                    confirmation.
                  </Txt>
                </div>
              ) : null}
              {isProductionStateError ? (
                <div
                  className="mt-4 flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3"
                  role="alert"
                >
                  <Txt variant="caption">Production state is unknown. Retry before moving the pointer.</Txt>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleRetryProductionState}
                    disabled={!onRetryProductionState || isProductionStateFetching}
                  >
                    {isProductionStateFetching ? 'Retrying Production state…' : 'Retry Production state'}
                  </Button>
                </div>
              ) : null}
              {integrityRecovery?.isBlocked ? (
                <div
                  className="mt-4 flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3"
                  role="alert"
                >
                  <Txt variant="caption">
                    Version-label integrity could not be verified. Production stays disabled until labels, version
                    history, and Production state are refreshed. Retry, then contact support if the problem continues.
                  </Txt>
                  {integrityRecovery.error ? (
                    <Txt variant="caption" className="text-destructive-bright">
                      {integrityRecovery.error}
                    </Txt>
                  ) : null}
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={integrityRecovery.onRetry}
                    disabled={integrityRecovery.isRetrying}
                  >
                    {integrityRecovery.isRetrying ? 'Retrying version-label state…' : 'Retry version-label state'}
                  </Button>
                </div>
              ) : null}
              {productionIntent?.needsReview ? (
                <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3" role="status">
                  <Txt variant="caption">
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
                <Txt variant="caption" className="mt-3 text-destructive-bright" role="alert">
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
                  isProductionMutationBlocked ||
                  !isDialogTargetUsable ||
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
