import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ManualResolutionContext } from "@/lib/api";

export function ManualResolution({
  context,
  canResolve,
  onResolve,
}: {
  context: ManualResolutionContext;
  canResolve: boolean;
  onResolve: (note: string, idempotencyKey: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const receiptIsForActiveTurn =
    context.receipt?.turnId === context.activeTurnId;
  const receipt = context.receipt && (
    <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 p-3 text-sm">
      <p className="font-medium">
        {receiptIsForActiveTurn
          ? "Manual resolution recorded"
          : "Previous manual resolution recorded"}
      </p>
      <p className="text-muted-foreground">
        Note delivery: {context.receipt.noteState} · close delivery:{" "}
        {context.receipt.closeState}
      </p>
    </div>
  );
  if (!canResolve || !context.activeTurnId || receiptIsForActiveTurn)
    return receipt ?? null;
  return (
    <div className="flex flex-col gap-2">
      {receipt}
      <form
        className="flex flex-col gap-2 rounded-lg border p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!note.trim()) return;
          setPending(true);
          try {
            await onResolve(note.trim(), key);
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="text-sm font-medium" htmlFor="manual-note">
          Internal resolution note
        </label>
        <textarea
          id="manual-note"
          className="min-h-24 rounded-md border bg-background p-2 text-sm"
          maxLength={4000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          This records an internal note, then closes the support conversation.
          It does not send a customer reply or approve a financial action.
        </p>
        <Button type="submit" disabled={pending || !note.trim()}>
          {pending ? "Recording…" : "Record note and close"}
        </Button>
      </form>
    </div>
  );
}
