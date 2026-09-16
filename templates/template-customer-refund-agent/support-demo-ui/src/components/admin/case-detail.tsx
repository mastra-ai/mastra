import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UrgencyBadge } from "@/components/status-badge";
import { ApprovalCard } from "@/components/admin/approval-card";
import { ManualResolution } from "@/components/admin/manual-resolution";
import type { ManualResolutionContext } from "@/lib/api";
import type { SupportCase } from "@/lib/types";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  PackageSearch,
  Receipt,
  ScrollText,
} from "lucide-react";

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function EvidenceCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-muted/20 p-3">
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

export function subscriptionDisplayName(plan: string) {
  return /^price_[A-Za-z0-9]+$/.test(plan) ? "Monthly subscription" : plan;
}

export function subscriptionInterval(
  interval: "month" | "year" | undefined,
  count: number | undefined,
) {
  if (!interval) return "billing period";
  const normalizedCount = count ?? 1;
  return normalizedCount === 1 ? interval : `${normalizedCount} ${interval}s`;
}

export function CaseDetail({
  supportCase,
  approverId,
  onDecision,
  canApprove,
  manualResolution,
  onManualResolution,
}: {
  supportCase: SupportCase;
  approverId: string;
  onDecision: (
    approved: boolean,
    commandFingerprint: string,
    note?: string,
    serviceProblemConfirmed?: true,
  ) => Promise<void>;
  canApprove: boolean;
  manualResolution?: ManualResolutionContext;
  onManualResolution?: (note: string, idempotencyKey: string) => Promise<void>;
}) {
  const c = supportCase;

  return (
    <div className="flex flex-col gap-4">
      {c.status === "waiting_approval" && canApprove && (
        <ApprovalCard
          supportCase={c}
          approverId={approverId}
          onDecision={onDecision}
        />
      )}

      {c.status === "escalated" && c.escalationReason && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Escalated</AlertTitle>
          <AlertDescription>
            <p>{c.escalationReason}</p>
            {c.approval && (
              <p>
                Decision by {c.approval.approverId}
                {c.approval.note ? `: "${c.approval.note}"` : ""}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {c.refundResult && (
        <Alert>
          <BadgeCheck />
          <AlertTitle>
            Refund{" "}
            {c.refundResult.status === "skipped"
              ? "already issued"
              : c.refundResult.status === "pending"
                ? "pending reconciliation"
                : c.refundResult.status === "failed"
                  ? "failed; staff review required"
                  : "issued"}
            : {c.refundResult.amount} {c.refundResult.currency}
          </AlertTitle>
          <AlertDescription>
            {c.refundResult.refundId} · order {c.refundResult.orderId} ·{" "}
            {new Date(c.refundResult.executedAt).toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      {c.subscriptionCreditResult && (
        <Alert>
          <BadgeCheck />
          <AlertTitle>
            Subscription credit{" "}
            {c.subscriptionCreditResult.status === "skipped"
              ? "already created"
              : c.subscriptionCreditResult.status === "pending"
                ? "pending receipt recovery"
                : c.subscriptionCreditResult.status === "failed"
                  ? "failed; staff review required"
                  : "created"}
            : {c.subscriptionCreditResult.amount}{" "}
            {c.subscriptionCreditResult.currency}
          </AlertTitle>
          <AlertDescription>
            {c.subscriptionCreditResult.creditId} · subscription{" "}
            {c.subscriptionCreditResult.subscriptionId} · available for a future
            invoice ·{" "}
            {new Date(c.subscriptionCreditResult.executedAt).toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="conversation">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="reasoning">AI Analysis</TabsTrigger>
          <TabsTrigger value="data">Order &amp; policy data</TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="flex flex-col gap-2">
          {c.messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-lg border p-3 text-sm ${
                message.author === "customer"
                  ? "mr-8 border-sky-700/50 bg-sky-950/20"
                  : message.author === "internal"
                    ? "border-amber-700/50 bg-amber-950/20"
                    : "ml-8 border-emerald-700/50 bg-emerald-950/20"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground capitalize">
                  {message.author === "agent"
                    ? "Support"
                    : message.author === "internal"
                      ? "Internal"
                      : "Customer"}
                  {message.authorName ? ` · ${message.authorName}` : ""}
                </span>
                <span>{new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{message.body}</p>
            </div>
          ))}
          {manualResolution &&
            onManualResolution &&
            (c.status === "escalated" || manualResolution.receipt) && (
              <ManualResolution
                key={`${c.id}:${manualResolution.activeTurnId ?? "none"}`}
                context={manualResolution}
                canResolve={c.status === "escalated"}
                onResolve={onManualResolution}
              />
            )}
        </TabsContent>

        <TabsContent value="reasoning" className="flex flex-col gap-4">
          {c.triage && (
            <Section
              icon={ScrollText}
              title="Triage"
              description="How the agent classified the case before drafting a response."
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {c.triage.intent.replace(/_/g, " ")}
                  </Badge>
                  <UrgencyBadge urgency={c.triage.urgency} />
                  <Badge variant="outline" className="capitalize">
                    {c.triage.sentiment}
                  </Badge>
                  <div
                    className={`rounded border px-2 py-1 text-xs ${
                      c.triage.confidence >= 0.8
                        ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-300"
                        : "border-yellow-700/50 bg-yellow-950/20 text-yellow-200"
                    }`}
                  >
                    Confidence: {Math.round(c.triage.confidence * 100)}%
                  </div>
                  {c.triage.requiresHumanReview && (
                    <Badge variant="destructive">Flagged for review</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{c.triage.rationale}</p>
              </div>
            </Section>
          )}

          {c.policyMatches && c.policyMatches.length > 0 && (
            <>
              <Separator />
              <Section
                icon={Receipt}
                title="Retrieved policy context"
                description="The passages pulled from the knowledge base to ground the reply."
              >
                <div className="flex flex-col gap-3">
                  {c.policyMatches.map((match, i) => (
                    <EvidenceCard
                      key={`${match.source}-${i}`}
                      title={match.title || match.source}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="text-muted-foreground">
                            Policy evidence
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 ${
                              match.score >= 0.7
                                ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-300"
                                : "border-yellow-700/50 bg-yellow-950/20 text-yellow-200"
                            }`}
                          >
                            Relevance: {match.score.toFixed(2)}
                          </span>
                        </div>
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">
                            Read policy excerpt
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                            {match.text}
                          </p>
                        </details>
                        <p className="text-xs text-muted-foreground">
                          Source: {match.source}
                          {match.version ? ` · version ${match.version}` : ""}
                          {match.effectiveAt
                            ? ` · effective ${new Date(match.effectiveAt).toLocaleDateString()}`
                            : ""}
                          {match.expiresAt
                            ? ` · expires ${new Date(match.expiresAt).toLocaleDateString()}`
                            : ""}
                          {match.documentHash
                            ? ` · hash ${match.documentHash.slice(0, 12)}…`
                            : ""}
                        </p>
                      </div>
                    </EvidenceCard>
                  ))}
                </div>
              </Section>
            </>
          )}

          {c.draft && (
            <>
              <Separator />
              <Section
                icon={ArrowUpRight}
                title="Draft resolution"
                description="The response draft the workflow prepared for the support team."
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={
                        c.draft.recommendRefund ||
                        c.draft.resolutionAction === "subscription_credit"
                          ? "default"
                          : "outline"
                      }
                    >
                      {c.draft.recommendRefund
                        ? "Recommends refund"
                        : c.draft.resolutionAction === "subscription_credit"
                          ? "Proposes subscription credit"
                          : "No financial action proposed"}
                    </Badge>
                    {c.draft.requiresEscalation && (
                      <Badge variant="destructive">Requires escalation</Badge>
                    )}
                  </div>
                  {c.draft.requiresEscalation && c.draft.escalationReason && (
                    <p className="text-muted-foreground">
                      {c.draft.escalationReason}
                    </p>
                  )}
                </div>
              </Section>
            </>
          )}
        </TabsContent>

        <TabsContent value="data" className="flex flex-col gap-4">
          <Section icon={PackageSearch} title="Order">
            {c.orderLookup?.found && c.orderLookup.order ? (
              <EvidenceCard title={c.orderLookup.order.product}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd>{c.orderLookup.order.orderId}</dd>
                  <dt className="text-muted-foreground">Product</dt>
                  <dd>{c.orderLookup.order.product}</dd>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd>
                    {money(
                      c.orderLookup.order.amount,
                      c.orderLookup.order.currency,
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Charges</dt>
                  <dd>{c.orderLookup.order.chargeCount}</dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{c.orderLookup.order.status}</dd>
                  <dt className="text-muted-foreground">Placed</dt>
                  <dd>
                    {new Date(
                      c.orderLookup.order.placedAt,
                    ).toLocaleDateString()}
                  </dd>
                </dl>
              </EvidenceCard>
            ) : (
              <p className="text-muted-foreground">
                No order on file for this customer.
              </p>
            )}
          </Section>

          {c.subscriptionLookup?.found && c.subscriptionLookup.subscription && (
            <>
              <Separator />
              <Section icon={Receipt} title="Subscription">
                <EvidenceCard
                  title={subscriptionDisplayName(
                    c.subscriptionLookup.subscription.plan,
                  )}
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <dt className="text-muted-foreground">Billing</dt>
                    <dd>
                      {money(
                        c.subscriptionLookup.subscription.amount,
                        c.subscriptionLookup.subscription.currency,
                      )}{" "}
                      /{" "}
                      {subscriptionInterval(
                        c.subscriptionLookup.subscription.recurringInterval,
                        c.subscriptionLookup.subscription
                          .recurringIntervalCount,
                      )}
                    </dd>
                    {/^price_[A-Za-z0-9]+$/.test(
                      c.subscriptionLookup.subscription.plan,
                    ) && (
                      <>
                        <dt className="text-muted-foreground">Plan ID</dt>
                        <dd className="break-all text-muted-foreground">
                          {c.subscriptionLookup.subscription.plan}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="capitalize">
                      {c.subscriptionLookup.subscription.status}
                    </dd>
                    <dt className="text-muted-foreground">Renews</dt>
                    <dd>
                      {new Date(
                        c.subscriptionLookup.subscription.renewsAt,
                      ).toLocaleDateString()}
                    </dd>
                  </dl>
                </EvidenceCard>
              </Section>
            </>
          )}

          {c.refundHistory && c.refundHistory.refunds.length > 0 && (
            <>
              <Separator />
              <Section icon={BadgeCheck} title="Prior refunds">
                <div className="flex flex-col gap-2">
                  {c.refundHistory.refunds.map((r) => (
                    <div
                      key={r.refundId}
                      className="flex justify-between border-b pb-1 last:border-0"
                    >
                      <span>{r.reason}</span>
                      <span className="text-muted-foreground">
                        {money(r.amount, r.currency)} ·{" "}
                        {new Date(r.issuedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Workflow run: {c.workflowRunId ?? "Not available"} · Last updated{" "}
        {new Date(c.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
