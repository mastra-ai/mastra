import { NextResponse } from 'next/server';
import { mastra } from '@/mastra';
import { isWorkflowId, WORKFLOW_IDS } from '@/lib/workflows';

/** Reports the current status of a run, including which step is suspended. */
export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const workflow = new URL(request.url).searchParams.get('workflow');

  if (!isWorkflowId(workflow)) {
    return NextResponse.json(
      { error: `Pass ?workflow= one of: ${WORKFLOW_IDS.join(', ')}` },
      { status: 400 },
    );
  }

  const state = await mastra.getWorkflow(workflow).getWorkflowRunById(runId);

  if (!state) {
    return NextResponse.json({ error: `No run found with id ${runId}` }, { status: 404 });
  }

  return NextResponse.json({
    runId: state.runId,
    workflow,
    status: state.status,
    result: state.result,
    error: state.error,
    suspendedSteps: Object.keys(state.suspendedPaths ?? {}),
  });
}
