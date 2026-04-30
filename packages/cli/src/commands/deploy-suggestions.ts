export interface DeployDiagnosisRecommendation {
  title: string;
  description: string;
  action: string | null;
  docsUrl: string | null;
}

export interface DeployDiagnosis {
  id: string;
  deployId: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  summary: string | null;
  recommendations: DeployDiagnosisRecommendation[] | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type DeployDiagnosisLookup =
  | { state: 'healthy' }
  | { state: 'missing' }
  | { state: 'ready'; diagnosis: DeployDiagnosis };

export function printDeploySuggestions(deployId: string, diagnosis: DeployDiagnosis) {
  console.info(`🩺 Deploy suggestions for ${deployId}`);
  console.info(`   Status:   ${diagnosis.status}`);

  if (diagnosis.summary) {
    console.info(`   Summary:  ${diagnosis.summary}`);
  }

  if (diagnosis.completedAt) {
    console.info(`   Updated:  ${diagnosis.completedAt}`);
  }

  const recommendations = diagnosis.recommendations ?? [];
  if (recommendations.length === 0) {
    console.info(
      '\nNo suggested changes are available for this failed deploy. This can happen if diagnosis hit an internal error. Check the deploy logs and try again in a moment.',
    );
    return;
  }

  console.info('\nSuggested changes:\n');
  for (const [index, recommendation] of recommendations.entries()) {
    console.info(` ${index + 1}. ${recommendation.title}`);
    console.info(`    ${recommendation.description}`);
    if (recommendation.action) {
      console.info(`    Action: ${recommendation.action}`);
    }
    if (recommendation.docsUrl) {
      console.info(`    Docs:   ${recommendation.docsUrl}`);
    }
    console.info('');
  }
}

export async function pollForDiagnosis(
  fetchDiagnosis: () => Promise<DeployDiagnosisLookup>,
): Promise<DeployDiagnosisLookup> {
  while (true) {
    const result = await fetchDiagnosis();
    if (result.state === 'healthy') {
      return result;
    }

    if (result.state === 'ready' && result.diagnosis.status !== 'PENDING') {
      return result;
    }

    console.info('Diagnosis in progress. Waiting for suggestions...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
