import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMonitoringSummary, type SupportSession } from "@/lib/api";
import type { MonitoringSummary } from "@/lib/types";
import {
  Info,
  MessageSquareWarning,
  RefreshCcw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Wallet,
} from "lucide-react";

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return "<1 min";
  if (value < 60) return `${value.toFixed(1)} min`;
  return `${(value / 60).toFixed(1)} hr`;
}

export function OperationHealth({
  title,
  entries,
}: {
  title: string;
  entries: MonitoringSummary["telemetry"]["workflowStages"];
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Unavailable — no retained spans.
        </p>
      ) : (
        entries.map((entry) => (
          <p
            key={`${title}-${entry.operation}`}
            className="text-xs text-muted-foreground"
          >
            {entry.operation}: {entry.calls} calls · errors{" "}
            {formatPercent(entry.errorRate)} · p95{" "}
            {entry.p95Ms === null ? "—" : `${entry.p95Ms.toFixed(0)} ms`}
          </p>
        ))
      )}
    </div>
  );
}

function RateCard({
  icon: Icon,
  title,
  value,
  description,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  description: string;
  tooltip: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-1.5">
            {title}
            <Tooltip>
              <TooltipTrigger>
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          </CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Containment, escalation, refund approvals, customer feedback, and the
 * token cost / tool health data Mastra already tracks for every case.
 * Rendered as a section within the admin page rather than its own route.
 */
export function MonitoringSection({
  session,
  view,
}: {
  session: SupportSession;
  view: "monitoring" | "telemetry";
}) {
  const mounted = useRef(true);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const result = await getMonitoringSummary(session);
        if (!mounted.current) return;
        setSummary(result);
      } catch (error) {
        if (mounted.current)
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load monitoring data",
          );
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [session],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => refresh(true), 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {view === "monitoring" ? "Monitoring" : "Telemetry"}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={refreshing}
        >
          {refreshing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCcw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!loading &&
        summary &&
        view === "monitoring" &&
        summary.casesConsidered === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No cases yet</EmptyTitle>
              <EmptyDescription>
                Send a case from the customer portal to start populating this
                dashboard.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

      {!loading &&
        summary &&
        view === "monitoring" &&
        summary.casesConsidered > 0 && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RateCard
                icon={ShieldCheck}
                title="Containment rate"
                value={formatPercent(summary.funnel.containmentRate)}
                description={`${summary.funnel.resolved} resolved without escalation, of ${summary.funnel.resolved + summary.funnel.escalated} decided cases.`}
                tooltip="Share of decided cases (resolved or escalated) that the agent closed on its own, without a human taking over."
              />
              <RateCard
                icon={MessageSquareWarning}
                title="Escalation rate"
                value={formatPercent(summary.funnel.escalationRate)}
                description={`${summary.funnel.escalated} of ${summary.funnel.resolved + summary.funnel.escalated} decided cases needed a human.`}
                tooltip="Share of decided cases that were escalated - either a rejected refund, a refund over the standard review limit, or a policy the agent couldn't resolve."
              />
              <RateCard
                icon={Wallet}
                title="Refund approval rate"
                value={formatPercent(summary.refunds.approvalRate)}
                description={`${summary.refunds.approved} approved / ${summary.refunds.rejected} rejected of ${summary.refunds.recommended} recommended.`}
                tooltip="Of the refunds a human reviewer decided on, the share that were approved."
              />
              <RateCard
                icon={
                  summary.feedback.up >= summary.feedback.down
                    ? ThumbsUp
                    : ThumbsDown
                }
                title="Customer satisfaction"
                value={formatPercent(summary.feedback.satisfactionRate)}
                description={`${summary.feedback.totalResponses} rating${summary.feedback.totalResponses === 1 ? "" : "s"} collected via the portal.`}
                tooltip="Share of customers who said the resolution solved their issue, out of everyone who left feedback."
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Case funnel</CardTitle>
                  <CardDescription>
                    Where {summary.funnel.totalCases} case
                    {summary.funnel.totalCases === 1 ? "" : "s"} ended up.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  {(
                    [
                      [
                        "New / processing",
                        summary.funnel.new + summary.funnel.processing,
                      ],
                      ["Waiting approval", summary.funnel.waitingApproval],
                      ["Resolved", summary.funnel.resolved],
                      ["Escalated", summary.funnel.escalated],
                      ["Failed", summary.funnel.failed],
                    ] as const
                  ).map(([label, count]) => (
                    <Progress
                      key={label}
                      value={
                        summary.funnel.totalCases > 0
                          ? (count / summary.funnel.totalCases) * 100
                          : 0
                      }
                    >
                      <div className="flex w-full items-center justify-between">
                        <ProgressLabel>{label}</ProgressLabel>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {count}
                        </span>
                      </div>
                    </Progress>
                  ))}
                  <Separator />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="size-4" />
                    Avg. time to close:{" "}
                    {formatMinutes(summary.funnel.avgResolutionMinutes)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Refunds</CardTitle>
                  <CardDescription>
                    Human-in-the-loop outcomes for recommended refunds.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Recommended</p>
                    <p className="text-2xl font-semibold">
                      {summary.refunds.recommended}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved</p>
                    <p className="text-2xl font-semibold">
                      {summary.refunds.approved}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rejected</p>
                    <p className="text-2xl font-semibold">
                      {summary.refunds.rejected}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Auto-escalated</p>
                    <p className="text-2xl font-semibold">
                      {summary.refunds.autoEscalated}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Executed / failed</p>
                    <p className="text-2xl font-semibold">
                      {summary.refunds.executed} / {summary.refunds.failed}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Separator className="mb-3" />
                    <p className="text-muted-foreground">
                      Executed totals (minor units)
                    </p>
                    {summary.refunds.executedTotals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      summary.refunds.executedTotals.map((total) => (
                        <p
                          key={total.currency}
                          className="text-2xl font-semibold"
                        >
                          {total.minor} {total.currency}
                        </p>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Recent customer feedback</CardTitle>
                <CardDescription>
                  Collected from the customer portal after a case closes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.feedback.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No feedback submitted yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {summary.feedback.recent.map((entry) => (
                      <div
                        key={entry.caseId}
                        className="flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="font-medium">{entry.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.submittedAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            entry.rating === "up" ? "default" : "destructive"
                          }
                          className="gap-1"
                        >
                          {entry.rating === "up" ? (
                            <ThumbsUp data-icon="inline-start" />
                          ) : (
                            <ThumbsDown data-icon="inline-start" />
                          )}
                          {entry.rating === "up" ? "Resolved" : "Not resolved"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Last updated {new Date(summary.generatedAt).toLocaleString()}
            </p>
          </>
        )}

      {!loading && summary && view === "telemetry" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Operational telemetry</CardTitle>
              <CardDescription>
                Model usage is counted from generation spans only, so parent and
                child spans are not double counted.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {summary.telemetry.unavailable.length > 0 && (
                <p className="text-muted-foreground">
                  Unavailable: {summary.telemetry.unavailable.join(", ")}
                </p>
              )}
              <p>
                Provider/tool error rate:{" "}
                {formatPercent(summary.telemetry.providerOrToolErrorRate)} ·
                p95:{" "}
                {summary.telemetry.providerOrToolP95Ms === null
                  ? "—"
                  : `${summary.telemetry.providerOrToolP95Ms.toFixed(0)} ms`}
              </p>
              {summary.telemetry.modelUsage.map((model) => (
                <p key={model.model} className="text-muted-foreground">
                  {model.model}: {model.inputTokens} input /{" "}
                  {model.outputTokens} output tokens; cost{" "}
                  {model.estimatedCostMicrosUsd === null
                    ? "unavailable"
                    : `${model.estimatedCostMicrosUsd} μUSD`}
                </p>
              ))}
              <OperationHealth
                title="Workflow stages"
                entries={summary.telemetry.workflowStages}
              />
              <OperationHealth
                title="Provider operations"
                entries={summary.telemetry.providerCalls}
              />
              <OperationHealth
                title="Tool operations"
                entries={summary.telemetry.toolCalls}
              />
              {summary.telemetry.alerts.length > 0 && (
                <p className="text-destructive">
                  Alerts: {summary.telemetry.alerts.join(", ")}
                </p>
              )}
              <p className="text-muted-foreground">
                Failures — rejected decisions:{" "}
                {summary.failures.rejectedDecisions}, workflow:{" "}
                {summary.failures.workflow}, financial:{" "}
                {summary.failures.financial}, delivery:{" "}
                {summary.failures.delivery}.
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Last updated {new Date(summary.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
