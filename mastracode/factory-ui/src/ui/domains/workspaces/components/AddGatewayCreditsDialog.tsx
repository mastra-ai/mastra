import { Button } from '@mastra/playground-ui/components/Button';
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
  DialogTrigger,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MAX_GATEWAY_CREDIT_PURCHASE, MIN_GATEWAY_CREDIT_PURCHASE } from '@mastra/factory/gateway-credit-purchase';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { MastraGatewayCredits } from '../../../../api/types';
import { useAddGatewayCredits } from '../../../../hooks/use-providers';
import { formatWholeDollars, mastraGatewayBilling } from './mastra-gateway-credits';

const PRESET_AMOUNTS = ['20', '50', '100', '500'];
const DEFAULT_AMOUNT = '20';

function amountProblem(draft: string): string | undefined {
  if (!draft) return 'Enter an amount';
  const amount = Number(draft);
  if (!Number.isInteger(amount)) return 'Credits come in whole dollars';
  if (amount < MIN_GATEWAY_CREDIT_PURCHASE)
    return `Minimum amount is ${formatWholeDollars(MIN_GATEWAY_CREDIT_PURCHASE)}`;
  if (amount > MAX_GATEWAY_CREDIT_PURCHASE)
    return `Maximum amount is ${formatWholeDollars(MAX_GATEWAY_CREDIT_PURCHASE)}`;
  return undefined;
}

/** Buys Mastra Gateway credits without leaving Factory; only a card payment step opens another tab. */
export function AddGatewayCreditsDialog({
  credits,
  trigger,
}: {
  credits: MastraGatewayCredits;
  trigger: ReactElement;
}) {
  const purchase = useAddGatewayCredits();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_AMOUNT);

  return (
    <Dialog
      open={open}
      pending={purchase.isPending}
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        if (!nextOpen) return;
        purchase.reset();
        setDraft(DEFAULT_AMOUNT);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        {purchase.data?.status === 'payment_required' ? (
          <>
            <DialogHeader>
              <DialogTitle>Finish the payment</DialogTitle>
              <DialogDescription>
                Pay {formatWholeDollars(Number(draft))} on the page that opens in a new tab. Your balance here updates
                when you come back.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <Button
                variant="primary"
                render={<a href={purchase.data.paymentUrl} target="_blank" rel="noreferrer" />}
                onClick={() => setOpen(false)}
              >
                Continue to payment
              </Button>
            </DialogFooter>
          </>
        ) : (
          <PurchaseForm
            credits={credits}
            draft={draft}
            onDraftChange={setDraft}
            pending={purchase.isPending}
            error={purchase.error?.message}
            onBuy={amount =>
              purchase.mutate(amount, {
                onSuccess: result => {
                  if (result.status === 'added') setOpen(false);
                },
              })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PurchaseForm({
  credits,
  draft,
  onDraftChange,
  pending,
  error,
  onBuy,
}: {
  credits: MastraGatewayCredits;
  draft: string;
  onDraftChange: (draft: string) => void;
  pending: boolean;
  error: string | undefined;
  onBuy: (amount: number) => void;
}) {
  const problem = amountProblem(draft);
  const buy = () => {
    if (problem === undefined && !pending) onBuy(Number(draft));
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Mastra Gateway credits</DialogTitle>
        <DialogDescription>
          Credits cost $1 each, and every Mastra Gateway model in your organization draws from them. Your saved card is
          charged right away; without one, you pay on a Stripe page.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Txt as="p" variant="caption" tone="muted">
          {mastraGatewayBilling(credits)}
        </Txt>
        <SegmentedControl aria-label="Credit amount" value={draft} onValueChange={onDraftChange} disabled={pending}>
          {PRESET_AMOUNTS.map(amount => (
            <SegmentedControlItem key={amount} value={amount}>
              {formatWholeDollars(Number(amount))}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <Input
          aria-label="Amount in dollars"
          inputMode="numeric"
          value={draft}
          disabled={pending}
          onChange={event => onDraftChange(event.target.value.replaceAll(',', '').trim())}
          onKeyDown={event => {
            if (event.key === 'Enter') buy();
          }}
        />
        {problem !== undefined && (
          <Txt as="p" variant="caption" tone="muted" role="note">
            {problem}
          </Txt>
        )}
        {error && (
          <div className="flex flex-col items-start gap-1">
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {error}
            </Txt>
            <Button
              variant="link"
              size="sm"
              render={<a href={credits.addCreditsUrl} target="_blank" rel="noreferrer" />}
            >
              Add credits on Mastra instead
            </Button>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogCancel>Cancel</DialogCancel>
        <DialogAction disabled={problem !== undefined} onConfirm={buy}>
          {pending ? 'Adding…' : `Add ${problem === undefined ? formatWholeDollars(Number(draft)) : 'credits'}`}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
