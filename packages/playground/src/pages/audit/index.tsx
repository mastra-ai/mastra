import { cn } from '@/lib/utils';
import {
  HeaderTitle,
  Header,
  MainContentLayout,
  AuditLogsList,
  auditLogsListColumns,
  PageHeader,
  AuditLogsTools,
  ActorTypeOption,
  OutcomeOption,
  ActionPrefixOption,
  actorTypeOptions,
  outcomeOptions,
  actionPrefixOptions,
  parseError,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  EntryListSkeleton,
  usePermissions,
} from '@mastra/playground-ui';
import { useState } from 'react';
import { ScrollTextIcon, ShieldAlertIcon } from 'lucide-react';
import { useAuditLogs } from '@/domains/audit/hooks/use-audit-logs';
import { Link } from 'react-router';

export default function Audit() {
  const { hasPermission, rbacEnabled, isLoading: isLoadingPermissions } = usePermissions();
  const canViewAudit = hasPermission('audit:read');

  const [selectedActorType, setSelectedActorType] = useState<ActorTypeOption>(actorTypeOptions[0]);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeOption>(outcomeOptions[0]);
  const [selectedActionPrefix, setSelectedActionPrefix] = useState<ActionPrefixOption>(actionPrefixOptions[0]);
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);

  const {
    data: events = [],
    isLoading: isEventsLoading,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
    error: eventsError,
    isError: isEventsError,
  } = useAuditLogs({
    filters: {
      ...(selectedActorType?.value !== 'all' && {
        actorType: selectedActorType.value as 'user' | 'system' | 'api-key',
      }),
      ...(selectedOutcome?.value !== 'all' && {
        outcome: selectedOutcome.value as 'success' | 'failure' | 'denied',
      }),
      ...(selectedActionPrefix?.value &&
        selectedActionPrefix.value !== 'all' && {
          actionPrefix: selectedActionPrefix.value,
        }),
      ...(selectedDateFrom && {
        startDate: selectedDateFrom,
      }),
      ...(selectedDateTo && {
        endDate: selectedDateTo,
      }),
    },
  });

  const handleReset = () => {
    setSelectedActorType(actorTypeOptions[0]);
    setSelectedOutcome(outcomeOptions[0]);
    setSelectedActionPrefix(actionPrefixOptions[0]);
    setSelectedDateFrom(undefined);
    setSelectedDateTo(undefined);
  };

  const handleDateChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') {
      setSelectedDateFrom(value);
    } else {
      setSelectedDateTo(value);
    }
  };

  const error = isEventsError ? parseError(eventsError) : undefined;

  const filtersApplied =
    selectedActorType?.value !== 'all' ||
    selectedOutcome?.value !== 'all' ||
    selectedActionPrefix?.value !== 'all' ||
    selectedDateFrom ||
    selectedDateTo;

  // Show access denied if RBAC is enabled and user doesn't have permission
  if (!isLoadingPermissions && rbacEnabled && !canViewAudit) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <ScrollTextIcon />
            </Icon>
            Audit Logs
          </HeaderTitle>
        </Header>

        <div className={cn('flex flex-col items-center justify-center h-full gap-4')}>
          <Icon className="w-16 h-16 text-neutral3">
            <ShieldAlertIcon />
          </Icon>
          <h2 className="text-xl font-medium text-neutral1">Access Denied</h2>
          <p className="text-neutral3">You don't have permission to view audit logs.</p>
        </div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <ScrollTextIcon />
          </Icon>
          Audit Logs
        </HeaderTitle>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <div className={cn(`grid overflow-y-auto h-full`)}>
        <div className={cn('max-w-[100rem] px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
          <PageHeader
            title="Audit Logs"
            description="Review authentication and system events"
            icon={<ScrollTextIcon />}
          />

          <AuditLogsTools
            selectedActorType={selectedActorType}
            selectedOutcome={selectedOutcome}
            selectedActionPrefix={selectedActionPrefix}
            selectedDateFrom={selectedDateFrom}
            selectedDateTo={selectedDateTo}
            onActorTypeChange={setSelectedActorType}
            onOutcomeChange={setSelectedOutcome}
            onActionPrefixChange={setSelectedActionPrefix}
            onDateChange={handleDateChange}
            onReset={handleReset}
            isLoading={isEventsLoading}
          />

          {isEventsLoading ? (
            <EntryListSkeleton columns={auditLogsListColumns} />
          ) : (
            <AuditLogsList
              events={events}
              errorMsg={error?.error}
              setEndOfListElement={setEndOfListElement}
              filtersApplied={Boolean(filtersApplied)}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
            />
          )}
        </div>
      </div>
    </MainContentLayout>
  );
}
