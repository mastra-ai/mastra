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
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@mastra/playground-ui/components/InputGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MAX_GATEWAY_CREDIT_PURCHASE, MIN_GATEWAY_CREDIT_PURCHASE } from '@mastra/factory/gateway-credit-purchase';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { useAddGatewayCredits } from '../../../../hooks/use-providers';
import { formatWholeDollars } from './mastra-gateway-credits';

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

export function AddGatewayCreditsDialog({ addCreditsUrl, trigger }: { addCreditsUrl: string; trigger: ReactElement }) {
  const purchase = useAddGatewayCredits();
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      pending={purchase.isPending}
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        if (nextOpen) purchase.reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        {purchase.isSuccess && purchase.data.status === 'payment_required' ? (
          <PaymentStep
            amount={purchase.variables}
            paymentUrl={purchase.data.paymentUrl}
            onContinue={() => setOpen(false)}
          />
        ) : (
          <PurchaseForm
            addCreditsUrl={addCreditsUrl}
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

function PaymentStep({
  amount,
  paymentUrl,
  onContinue,
}: {
  amount: number;
  paymentUrl: string;
  onContinue: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Finish the payment</DialogTitle>
        <DialogDescription>
          Pay {formatWholeDollars(amount)} on the page that opens in a new tab. Your balance here updates when you come
          back.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogCancel>Cancel</DialogCancel>
        <Button
          variant="primary"
          render={<a href={paymentUrl} target="_blank" rel="noreferrer" />}
          onClick={onContinue}
        >
          Continue to payment
        </Button>
      </DialogFooter>
    </>
  );
}

function PurchaseForm({
  addCreditsUrl,
  pending,
  error,
  onBuy,
}: {
  addCreditsUrl: string;
  pending: boolean;
  error: string | undefined;
  onBuy: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(DEFAULT_AMOUNT);
  const problem = amountProblem(draft);
  const buyLabel = problem === undefined ? `Add ${formatWholeDollars(Number(draft))}` : 'Add credits';
  const buy = () => {
    if (problem === undefined) onBuy(Number(draft));
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add credits</DialogTitle>
        <DialogDescription>
          Your organization’s saved card is charged right away. Without one, you pay on Stripe.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Field>
          <FieldLabel>Amount</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              inputMode="numeric"
              value={draft}
              disabled={pending}
              onChange={event => setDraft(event.target.value.replaceAll(',', '').trim())}
              onKeyDown={event => {
                if (event.key === 'Enter') buy();
              }}
            />
          </InputGroup>
          {problem !== undefined && <FieldDescription>{problem}</FieldDescription>}
        </Field>
        {error && (
          <div className="flex flex-col items-start gap-1">
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {error}
            </Txt>
            <Button variant="link" size="sm" render={<a href={addCreditsUrl} target="_blank" rel="noreferrer" />}>
              Open credits on Mastra
            </Button>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogCancel>Cancel</DialogCancel>
        <DialogAction disabled={problem !== undefined} onConfirm={buy}>
          {pending ? 'Adding…' : buyLabel}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
