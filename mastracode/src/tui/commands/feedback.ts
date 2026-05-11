import { getUserName } from '../../utils/project.js';
import type { SlashCommandContext } from './types.js';

/**
 * /feedback command — annotate the most recent trace with user feedback.
 *
 * Feedback is emitted through the observability event bus so it reaches all
 * configured exporters (DuckDB, cloud, Langfuse, etc.) without requiring
 * direct storage access.  A minimal correlationContext is supplied so the
 * observability layer does not need to re-hydrate the trace from storage —
 * this keeps the command working even when the local DuckDB is locked by
 * another process.
 *
 * Usage:
 *   /feedback up                         — thumbs up
 *   /feedback down                       — thumbs down
 *   /feedback down Bad tool selection    — thumbs down with comment
 *   /feedback 4                          — numeric rating (0–10)
 *   /feedback comment Great response     — text comment only
 */
export async function handleFeedbackCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  if (args.length === 0) {
    ctx.showInfo(`Usage:
  /feedback up                       — thumbs up
  /feedback down                     — thumbs down
  /feedback down <comment>           — thumbs down with comment
  /feedback <0-10>                   — numeric rating
  /feedback comment <text>           — text comment only`);
    return;
  }

  // Resolve trace context.
  // getCurrentTraceId() returns the actual observability traceId (OTel 32-hex-char ID)
  // captured from the stream response. getCurrentRunId() returns the agent's runId (UUID).
  // We pass both so the cloud endpoint can correlate feedback to the correct trace.
  const traceId = ctx.harness.getCurrentTraceId() ?? undefined;
  const runId = ctx.harness.getCurrentRunId() ?? undefined;
  const threadId = ctx.harness.getCurrentThreadId() ?? undefined;

  if (!traceId && !runId && !threadId) {
    ctx.showError('No active session to attach feedback to.');
    return;
  }

  // Get observability from the Mastra instance so feedback flows through the
  // event bus to all exporters (cloud, DuckDB, etc.).
  const mastra = ctx.harness.getMastra();
  const observability = mastra?.observability;
  if (!observability?.addFeedback) {
    ctx.showError('Observability not configured — cannot save feedback.');
    return;
  }

  // Parse the feedback input
  const subcommand = args[0]!.toLowerCase();
  const rest = args.slice(1).join(' ').trim();

  let feedbackType: string;
  let value: number | string;
  let comment: string | undefined;

  if (subcommand === 'up') {
    feedbackType = 'thumbs';
    value = 1;
    comment = rest || undefined;
  } else if (subcommand === 'down') {
    feedbackType = 'thumbs';
    value = 0;
    comment = rest || undefined;
  } else if (subcommand === 'comment') {
    if (!rest) {
      ctx.showError('Please provide a comment: /feedback comment <text>');
      return;
    }
    feedbackType = 'comment';
    value = rest;
    comment = rest;
  } else {
    // Try numeric rating
    const num = Number(subcommand);
    if (!Number.isNaN(num) && num >= 0 && num <= 10) {
      feedbackType = 'rating';
      value = num;
      comment = rest || undefined;
    } else {
      ctx.showError(`Unknown feedback type: "${subcommand}". Use up, down, comment, or a number 0-10.`);
      return;
    }
  }

  try {
    await observability.addFeedback({
      // Pass the actual traceId so the feedback is correlated to the trace.
      traceId,
      // Supply a correlationContext so the observability layer emits the event
      // directly without looking up the trace from storage (which may be locked).
      correlationContext: {
        traceId,
        runId,
      },
      feedback: {
        feedbackType,
        feedbackSource: 'mastracode',
        feedbackUserId: getUserName(),
        value,
        comment,
        metadata: {
          ...(threadId ? { threadId } : {}),
          ...(runId ? { runId } : {}),
        },
      },
    });

    // Build confirmation message
    let msg: string;
    if (feedbackType === 'thumbs') {
      msg = value === 1 ? 'Feedback recorded: 👍' : 'Feedback recorded: 👎';
    } else if (feedbackType === 'rating') {
      msg = `Feedback recorded: ${value}/10`;
    } else {
      msg = 'Comment recorded.';
    }
    if (comment && feedbackType !== 'comment') {
      msg += ` — "${comment}"`;
    }

    ctx.showInfo(msg);
  } catch (err) {
    ctx.showError(`Failed to save feedback: ${err instanceof Error ? err.message : String(err)}`);
  }
}
