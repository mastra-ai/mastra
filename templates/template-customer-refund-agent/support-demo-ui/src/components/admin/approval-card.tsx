import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { SupportCase } from "@/lib/types";

export function ApprovalCard({
  supportCase,
  approverId,
  onDecision,
}: {
  supportCase: SupportCase;
  approverId: string;
  onDecision: (
    approved: boolean,
    commandFingerprint: string,
    note?: string,
    serviceProblemConfirmed?: true,
  ) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [confirmedServiceProblemScope, setConfirmedServiceProblemScope] =
    useState<string>();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const draft = supportCase.draft;
  const isCredit = draft?.resolutionAction === "subscription_credit";
  const metadata = supportCase.metadata as Record<string, unknown>;
  const commandFingerprint = (
    (isCredit ? metadata.subscriptionCreditCommand : metadata.refundCommand) as
      { fingerprint?: string } | undefined
  )?.fingerprint;
  // Scope the acknowledgement to the exact immutable command. If an operator
  // selects another case while this card stays mounted, the old acknowledgement
  // cannot enable approval for the newly rendered command.
  const serviceProblemConfirmationScope = `${supportCase.id}:${commandFingerprint ?? ""}`;
  const serviceProblemConfirmed =
    confirmedServiceProblemScope === serviceProblemConfirmationScope;
  const amount = isCredit
    ? draft?.subscriptionCreditAmount
    : draft?.refundAmount;
  const currency = isCredit
    ? draft?.subscriptionCreditCurrency
    : draft?.refundCurrency;
  const reason = isCredit
    ? draft?.subscriptionCreditReason
    : draft?.refundReason;
  if (!draft) return null;

  async function handle(approved: boolean) {
    setPending(approved ? "approve" : "reject");
    try {
      if (!commandFingerprint)
        throw new Error(
          "This approval command is unavailable. Refresh the case.",
        );
      await onDecision(
        approved,
        commandFingerprint,
        note || undefined,
        isCredit && approved && serviceProblemConfirmed ? true : undefined,
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isCredit
            ? "Subscription credit approval requested"
            : "Refund approval requested"}
        </CardTitle>
        <CardDescription>
          Reviewing as <span className="font-medium">{approverId}</span>.
          {isCredit
            ? "No billing balance is changed until you decide."
            : "Nothing is charged or refunded until you decide."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-medium">
              {amount} {currency}
            </p>
          </div>
          <div className="min-w-52">
            <p className="text-muted-foreground">Immutable command</p>
            <code
              className="block truncate font-medium"
              title={commandFingerprint}
            >
              {commandFingerprint ?? "Unavailable"}
            </code>
          </div>
          <div>
            <p className="text-muted-foreground">
              {isCredit ? "Subscription" : "Order"}
            </p>
            <p className="font-medium">
              {isCredit
                ? (supportCase.subscriptionLookup?.subscription
                    ?.subscriptionId ?? "Not found")
                : (supportCase.orderLookup?.order?.orderId ?? "Not found")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Reason</p>
            <p className="font-medium">{reason}</p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Drafted customer reply</p>
          <p className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap">
            {draft.draftResponse}
          </p>
          {draft.citedSources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.citedSources.map((source) => (
                <Badge key={source} variant="outline">
                  {source}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <FieldGroup>
          {isCredit && (
            <Field>
              <label className="flex items-start gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={serviceProblemConfirmed}
                  onChange={(event) =>
                    setConfirmedServiceProblemScope(
                      event.target.checked
                        ? serviceProblemConfirmationScope
                        : undefined,
                    )
                  }
                />
                <span>
                  I confirm the reported service problem before approving this
                  credit.
                </span>
              </label>
              <FieldDescription>
                This confirmation and your authenticated approval are recorded
                together before any billing balance change.
              </FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="approval-note">Internal note</FieldLabel>
            <Textarea
              id="approval-note"
              placeholder="Optional note that will be saved in the case history"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <FieldDescription>
              Use this if you want to explain why you approved or rejected the
              recommendation.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <div className="flex gap-2">
          <Button
            onClick={() => handle(true)}
            disabled={
              pending !== null || (isCredit && !serviceProblemConfirmed)
            }
          >
            {pending === "approve" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CheckCircle2 data-icon="inline-start" />
            )}
            {isCredit ? "Approve credit" : "Approve refund"}
          </Button>
          <Button
            onClick={() => handle(false)}
            disabled={pending !== null}
            variant="outline"
          >
            {pending === "reject" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <XCircle data-icon="inline-start" />
            )}
            Reject and escalate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
