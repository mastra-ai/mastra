import { MastraError } from '../../error';
import type { Mastra } from '../../mastra';

export async function scoreTraces({
  scorerName,
  targets,
  mastra,
}: {
  scorerName: string;
  targets: { traceId: string; spanId?: string }[];
  mastra: Mastra;
}) {
  const workflow = mastra.__getInternalWorkflow('__batch-scoring-traces');
  try {
    const run = await workflow.createRunAsync();
    await run.start({ inputData: { targets, scorerName } });
  } catch (error) {
    const mastraError = new MastraError(
      {
        category: 'SYSTEM',
        domain: 'SCORER',
        id: 'MASTRA_SCORER_FAILED_TO_RUN_TRACE_SCORING',
        details: {
          scorerName,
          targets: JSON.stringify(targets),
        },
      },
      error,
    );
    mastra.getLogger()?.trackException(mastraError);
    mastra.getLogger()?.error(mastraError.toString());
  }
}
