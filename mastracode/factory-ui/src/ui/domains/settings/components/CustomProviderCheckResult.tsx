import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { CustomProviderCheckFailure, CustomProviderModelTestResult } from '../../../../api/types';

/** The last connection test the form ran, from Test or from a refused Test & save. */
export type ConnectionOutcome =
  | { ok: true; models: string[]; latencyMs: number }
  | { ok: false; failure: CustomProviderCheckFailure; refusedSave: boolean };

/** Scrolls a result into view when it appears, since it renders below fields the user may have scrolled past. */
function revealResult(node: HTMLDivElement | null) {
  node?.scrollIntoView?.({ block: 'nearest' });
}

/** The upstream excerpt of a failure, kept verbatim in a monospace block. */
function FailureDetail({ detail }: { detail: string | undefined }) {
  if (!detail) return null;
  return (
    <Txt as="p" variant="caption" font="mono" className="whitespace-pre-wrap">
      {detail}
    </Txt>
  );
}

/** Says a result was produced for settings the user has since changed, instead of showing it as current. */
function OutdatedResult() {
  return (
    <Notice variant="note" role="status">
      The settings changed after the last test. Test again to check them.
    </Notice>
  );
}

/** The outcome of the last connection test, or a note when the fields no longer match it. */
export function ConnectionCheckResult({ outcome, outdated }: { outcome: ConnectionOutcome; outdated: boolean }) {
  if (outdated) return <OutdatedResult />;
  if (outcome.ok) {
    const count = outcome.models.length;
    return (
      <div ref={revealResult}>
        <Notice variant="success" role="status">
          Endpoint answered in {outcome.latencyMs} ms and lists {count} model{count === 1 ? '' : 's'}. This check does
          not call a model.
        </Notice>
      </div>
    );
  }
  return (
    <div ref={revealResult}>
      <Notice variant="destructive" role="alert" title={outcome.failure.message}>
        {outcome.refusedSave && (
          <span>Nothing was saved. Fix the settings, or use Save anyway to keep them untested.</span>
        )}
        <FailureDetail detail={outcome.failure.detail} />
      </Notice>
    </div>
  );
}

/** The reply to the test message, or why the model call failed. */
export function ModelTestResult({
  model,
  result,
  outdated,
}: {
  model: string;
  result: CustomProviderModelTestResult;
  outdated: boolean;
}) {
  if (outdated) return <OutdatedResult />;
  if (!result.ok) {
    return (
      <div ref={revealResult}>
        <Notice variant="destructive" role="alert" title={result.failure.message}>
          <FailureDetail detail={result.failure.detail} />
        </Notice>
      </div>
    );
  }
  if (!result.reply) {
    const reason = result.finishReason ? ` Finish reason: ${result.finishReason}.` : '';
    return (
      <div ref={revealResult}>
        <Notice variant="warning" role="status">
          {model} answered in {result.latencyMs} ms with an empty reply.{reason}
        </Notice>
      </div>
    );
  }
  return (
    <div ref={revealResult}>
      <Notice variant="success" role="status" title={`${model} replied in ${result.latencyMs} ms`}>
        <Txt as="p" variant="caption" font="mono" className="whitespace-pre-wrap">
          {result.reply}
        </Txt>
      </Notice>
    </div>
  );
}
