import * as p from '@clack/prompts';
import pc from 'picocolors';

import { withPollingRetries } from '../utils/polling.js';

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

export interface PrintSuggestionsOptions {
  logsUrl?: string;
}

export function printDeploySuggestions(
  deployId: string,
  diagnosis: DeployDiagnosis,
  options?: PrintSuggestionsOptions,
) {
  if (diagnosis.status === 'FAILED') {
    p.log.error(`Diagnosis failed: ${diagnosis.error ?? 'unknown error'}`);
    return;
  }

  const meta = [pc.dim(`Deploy: ${deployId}`)];
  if (diagnosis.completedAt) {
    meta.push(pc.dim(`Diagnosed: ${diagnosis.completedAt}`));
  }
  p.log.step(meta.join(pc.dim(' · ')));

  p.log.message(pc.bold(pc.magenta(`🏥 Deploy Suggestions`)));

  if (diagnosis.summary) {
    p.log.message(pc.bold(pc.cyan(`Summary: `)) + diagnosis.summary);
  }

  const recommendations = diagnosis.recommendations ?? [];
  if (recommendations.length === 0) {
    p.log.warn(
      `No suggestions could be generated. The deploy may have failed due to an internal error — check the deploy logs for details.`,
    );
  } else {
    const lines: string[] = [];
    for (const [index, recommendation] of recommendations.entries()) {
      lines.push(`${pc.bold(pc.cyan(`${index + 1}.`))} ${pc.bold(recommendation.title)}`);
      lines.push(pc.dim(`   ${recommendation.description}`));
      if (recommendation.action) {
        lines.push(`   ${pc.green('▸')} ${pc.green(recommendation.action)}`);
      }
      if (recommendation.docsUrl) {
        lines.push(`   ${pc.blue('↗')} ${pc.underline(pc.blue(recommendation.docsUrl))}`);
      }
      lines.push('');
    }

    p.log.message(lines.join('\n'));
  }

  const logsUrl = options?.logsUrl ?? `https://projects.mastra.ai`;
  p.log.step(`Deploy logs: ${pc.underline(pc.blue(logsUrl))}`);
}

const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function pollForDiagnosis(
  fetchDiagnosis: () => Promise<DeployDiagnosisLookup>,
): Promise<DeployDiagnosisLookup> {
  const spinner = p.spinner();
  spinner.start(pc.cyan('Diagnosing deploy failure'));
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  try {
    while (true) {
      const result = await withPollingRetries(fetchDiagnosis);
      if (result.state === 'healthy') {
        spinner.stop(pc.green('Deploy is healthy'));
        return result;
      }

      if (result.state === 'ready' && result.diagnosis.status !== 'PENDING') {
        spinner.stop(pc.green('Diagnosis complete'));
        return result;
      }

      if (Date.now() >= deadline) {
        throw new Error('Diagnosis polling timed out after 5 minutes. Please try again later.');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    spinner.stop(pc.red('Diagnosis failed'));
    throw error;
  }
}
