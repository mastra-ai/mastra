import { NextResponse } from 'next/server';
import { resumeHook } from 'workflow/api';
import { HookNotFoundError } from 'workflow/errors';
import { APPROVAL_STEP_ID } from '@/mastra/workflows/approval';

/**
 * Resumes a suspended `approval-workflow` run with a human decision.
 *
 * A suspended Mastra step parks on a Workflow SDK hook whose token is
 * `mastra:<runId>:<stepId>`, so any process holding the run id can deliver the
 * decision. Releasing the hook returns as soon as the decision is recorded.
 *
 * `run.resume()` would also work here, but it waits for the run to reach its
 * next stopping point, which would hold this request open for the rest of the
 * workflow. This route answers 202 instead and the client polls for the
 * outcome.
 */
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    await resumeHook(`mastra:${runId}:${APPROVAL_STEP_ID}`, {
      approved: body.approved ?? true,
      approver: String(body.approver ?? 'sam@example.com'),
    });
  } catch (error) {
    // Either the run id is wrong, or the step already resumed and the hook is
    // gone — a double-click on Approve lands here.
    if (HookNotFoundError.is(error)) {
      return NextResponse.json({ error: 'This run has no step waiting for a decision' }, { status: 404 });
    }

    throw error;
  }

  return NextResponse.json({ runId, resumed: true }, { status: 202 });
}
