import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';
import { WORKFLOW_IDS } from '@/lib/workflows';

/**
 * Starts a workflow run.
 *
 * `startAsync()` returns as soon as the run is enqueued. From there the
 * Workflow SDK drives it durably, so this request doesn't have to stay
 * open while the counter loops or the approval waits for a human.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.workflow === 'incrementWorkflow') {
    const run = await mastra.getWorkflow('incrementWorkflow').createRun();
    await run.startAsync({ inputData: { value: Number(body.value ?? 0) } });

    return NextResponse.json({ runId: run.runId, workflow: body.workflow });
  }

  if (body.workflow === 'approvalWorkflow') {
    const run = await mastra.getWorkflow('approvalWorkflow').createRun();
    await run.startAsync({
      inputData: {
        amount: Number(body.amount ?? 250),
        requestedBy: String(body.requestedBy ?? 'alex@example.com'),
      },
    });

    return NextResponse.json({ runId: run.runId, workflow: body.workflow });
  }

  return NextResponse.json(
    { error: `Unknown workflow. Expected one of: ${WORKFLOW_IDS.join(', ')}` },
    { status: 400 },
  );
}
