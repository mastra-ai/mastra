import type { Mastra } from '@mastra/core';
import type { Agent, MastraDBMessage } from '@mastra/core/agent';
import type { MastraScorer, ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/evals';
import type { MastraStorage } from '@mastra/core/storage';
import pMap from 'p-map';
import { createDatasetSource } from './dataset';
import { renderTrainingData, renderValidationData, getSftStats, getDpoStats } from './rendering';
import { createScorecard } from './scoring';
import type {
  AgentCase,
  AgentMessage,
  AgentRunRecord,
  FitAgentOptions,
  FitAgentResult,
  ProgressCallback,
  Scorecard,
  ScorerResult,
  TrainerProvider,
  TrainingJob,
  TrainingProgress,
} from './types';
import { applySelection } from './utils/selection';

/**
 * Convert an AgentMessage to MastraDBMessage format.
 */
function agentMessageToMastraDBMessage(msg: AgentMessage, index: number): MastraDBMessage {
  return {
    id: `msg-${index}`,
    role: msg.role === 'tool' ? 'assistant' : msg.role,
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text: msg.content }],
    },
  };
}

/**
 * Convert AgentCase to ScorerRunInputForAgent format.
 */
function convertToScorerInput(case_: AgentCase): ScorerRunInputForAgent {
  const systemMessages: AgentMessage[] = [];
  const inputMessages: AgentMessage[] = [];

  for (const msg of case_.messages) {
    if (msg.role === 'system') {
      systemMessages.push(msg);
    } else if (msg.role !== 'assistant') {
      inputMessages.push(msg);
    }
  }

  return {
    inputMessages: inputMessages.map((msg, i) => agentMessageToMastraDBMessage(msg, i)),
    rememberedMessages: [],
    systemMessages: systemMessages.map(msg => ({
      role: 'system' as const,
      content: msg.content,
    })),
    taggedSystemMessages: {},
  };
}

/**
 * Convert AgentMessage[] to ScorerRunOutputForAgent format.
 */
function convertToScorerOutput(messages: AgentMessage[]): ScorerRunOutputForAgent {
  return messages.filter(msg => msg.role === 'assistant').map((msg, i) => agentMessageToMastraDBMessage(msg, i));
}

export interface TrainerOptions {
  mastra: Mastra;
  provider: TrainerProvider;
  storage?: MastraStorage;
}

/**
 * The Trainer class orchestrates agent training using Mastra's scorer system
 * and external training providers (like OpenAI).
 */
export class Trainer {
  private mastra: Mastra;
  private provider: TrainerProvider;
  private storage?: MastraStorage;

  constructor(options: TrainerOptions) {
    this.mastra = options.mastra;
    this.provider = options.provider;
    this.storage = options.storage || options.mastra.getStorage();
  }

  /**
   * Train an agent using the specified method and configuration.
   */
  async fitAgent(agent: Agent, options: FitAgentOptions): Promise<FitAgentResult> {
    const { method, data, selection, provider, onProgress } = options;

    // Helper to report progress
    const reportProgress = async (progress: TrainingProgress) => {
      console.log(`[Trainer] ${progress.stageLabel} (${progress.current}/${progress.total} - ${progress.percentage}%)`);
      if (onProgress) {
        await onProgress(progress);
      }
    };

    console.log(`[Trainer] fitAgent started for agent ${agent.name}, method: ${method}`);

    // 1. Load dataset
    await reportProgress({
      stage: 'loading',
      stageLabel: 'Loading dataset...',
      current: 0,
      total: 1,
      percentage: 0,
    });

    // Auto-set 'until' filter to current time to avoid loading traces
    // created during this training run (which would cause feedback loops)
    const trainingStartTime = new Date();
    let dataConfig = data;
    if (data.source === 'traces' && !data.filter?.until) {
      dataConfig = {
        ...data,
        filter: {
          ...data.filter,
          until: trainingStartTime,
        },
      };
      console.log(`[Trainer] Auto-filtering traces to before ${trainingStartTime.toISOString()}`);
    }

    const datasetSource = createDatasetSource(dataConfig, this.storage);
    const cases = await datasetSource.getCases();
    console.log(`[Trainer] Loaded ${cases.length} cases`);

    if (cases.length === 0) {
      throw new Error('No training cases found');
    }

    await reportProgress({
      stage: 'loading',
      stageLabel: `Loaded ${cases.length} cases`,
      current: 1,
      total: 1,
      percentage: 100,
    });

    // 2. Generate runs and score them
    console.log(`[Trainer] Step 2: Generating runs and scoring ${cases.length} cases (this may take a while)...`);
    const scorecards = await this.generateAndScoreCases(agent, cases, options, reportProgress);
    console.log(`[Trainer] Generated ${scorecards.length} scorecards`);

    if (scorecards.length === 0) {
      throw new Error('No scorecards generated');
    }

    // 3. Apply selection criteria
    await reportProgress({
      stage: 'selecting',
      stageLabel: 'Applying selection criteria...',
      current: 0,
      total: 1,
      percentage: 0,
    });
    const { selected, holdout } = applySelection(scorecards, selection || {}, method);
    console.log(`[Trainer] Selected ${selected.length} examples, ${holdout.length} holdout`);

    if (selected.length === 0) {
      throw new Error('No examples passed selection criteria');
    }

    await reportProgress({
      stage: 'selecting',
      stageLabel: `Selected ${selected.length} examples, ${holdout.length} holdout`,
      current: 1,
      total: 1,
      percentage: 100,
    });

    // 4. Render training data
    await reportProgress({
      stage: 'rendering',
      stageLabel: 'Rendering training data...',
      current: 0,
      total: 1,
      percentage: 0,
    });
    const trainingData = renderTrainingData(method, selected);
    const validationData = holdout.length > 0 ? renderValidationData(method, holdout) : undefined;

    // Validate that we have actual training data
    if (trainingData.length === 0) {
      if (method === 'dpo') {
        throw new Error(
          'No valid DPO training examples generated. DPO requires multiple candidates per case to form preference pairs. ' +
            'Either:\n' +
            '  1. Set candidatesPerCase > 1 in the data config to generate multiple responses per case, or\n' +
            '  2. Ensure your traces already contain multiple responses per case with different scores.\n' +
            'Example: data: { source: "traces", candidatesPerCase: 3 }',
        );
      }
      throw new Error('No training examples could be rendered from the selected scorecards');
    }

    await reportProgress({
      stage: 'rendering',
      stageLabel: 'Training data rendered',
      current: 1,
      total: 1,
      percentage: 100,
    });

    // 5. Upload files to provider
    await reportProgress({
      stage: 'uploading',
      stageLabel: 'Uploading training file...',
      current: 0,
      total: validationData ? 2 : 1,
      percentage: 0,
    });
    const timestamp = Date.now();
    const trainingFilename = `mastra-${agent.name}-${method}-train-${timestamp}.jsonl`;
    const validationFilename = `mastra-${agent.name}-${method}-val-${timestamp}.jsonl`;

    const { fileId: trainingFileId } = await this.provider.uploadFile(trainingData, trainingFilename, 'fine-tune');
    console.log(`[Trainer] Training file uploaded: ${trainingFileId}`);

    let validationFileId: string | undefined;
    if (validationData) {
      await reportProgress({
        stage: 'uploading',
        stageLabel: 'Uploading validation file...',
        current: 1,
        total: 2,
        percentage: 50,
      });
      const result = await this.provider.uploadFile(validationData, validationFilename, 'fine-tune');
      validationFileId = result.fileId;
      console.log(`[Trainer] Validation file uploaded: ${validationFileId}`);
    }

    await reportProgress({
      stage: 'uploading',
      stageLabel: 'Files uploaded',
      current: validationData ? 2 : 1,
      total: validationData ? 2 : 1,
      percentage: 100,
    });

    // 6. Start training job
    await reportProgress({
      stage: 'submitting',
      stageLabel: 'Submitting training job to OpenAI...',
      current: 0,
      total: 1,
      percentage: 0,
    });
    const suffix = `mastra-${agent.name}`;
    const { jobId } = await this.provider.startJob({
      method,
      baseModel: provider.baseModel,
      trainingFileId,
      validationFileId,
      hyperparams: provider.hyperparams,
      suffix,
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        trainingExamples: String(selected.length),
        validationExamples: String(holdout.length),
      },
    });
    console.log(`[Trainer] Training job started: ${jobId}`);

    // 7. Get initial job status
    const job = await this.provider.getJob(jobId);
    console.log(`[Trainer] Initial job status: ${job.status}`);

    await reportProgress({
      stage: 'training',
      stageLabel: `Training job submitted (${job.status})`,
      current: 1,
      total: 1,
      percentage: 100,
    });

    return {
      jobId,
      status: job.status,
      artifacts: {
        trainingFile: trainingFileId,
        validationFile: validationFileId,
      },
      trainingExamples: selected.length,
      validationExamples: holdout.length,
    };
  }

  /**
   * Generate runs for cases and score them.
   */
  private async generateAndScoreCases(
    agent: Agent,
    cases: AgentCase[],
    options: FitAgentOptions,
    reportProgress?: (progress: TrainingProgress) => Promise<void>,
  ): Promise<Scorecard[]> {
    const { method, scoring, data } = options;
    const scorecards: Scorecard[] = [];

    // Check if we should use original outputs from traces
    // Default: true for SFT with traces source, false for DPO (which needs multiple candidates)
    const useOriginalOutputs =
      data.source === 'traces' ? (data as any).useOriginalOutputs !== false && method === 'sft' : false;

    if (useOriginalOutputs) {
      console.log(`[Trainer] Using original outputs from traces (no regeneration)`);
    }

    // Get scorers from agent or Mastra
    console.log(`[Trainer] Getting scorers...`);
    const scorers = await this.getScorers(agent, scoring);
    console.log(`[Trainer] Found ${scorers.size} scorers: ${Array.from(scorers.keys()).join(', ')}`);

    // For DPO, we need multiple candidates per case
    // Default to 3 candidates for DPO if not specified, 1 for SFT
    let candidatesPerCase = (data as any).candidatesPerCase ?? (method === 'dpo' ? 3 : 1);
    const variationConfig = (data as any).variationConfig;

    // Ensure DPO has at least 2 candidates
    if (method === 'dpo' && candidatesPerCase < 2) {
      console.warn(`[Trainer] Warning: DPO requires at least 2 candidates per case. Setting candidatesPerCase to 3.`);
      candidatesPerCase = 3;
    }

    console.log(`[Trainer] Method: ${method}, candidatesPerCase: ${candidatesPerCase}`);

    let processedCount = 0;
    const totalCases = cases.length;

    // Report initial progress
    const stageLabel = useOriginalOutputs ? 'Scoring' : 'Generating & scoring';
    if (reportProgress) {
      await reportProgress({
        stage: useOriginalOutputs ? 'scoring' : 'generating',
        stageLabel: `${stageLabel}: 0/${totalCases} cases`,
        current: 0,
        total: totalCases,
        percentage: 0,
      });
    }

    await pMap(
      cases,
      async case_ => {
        if (method === 'dpo' && candidatesPerCase > 1) {
          // Generate multiple candidates for DPO
          const temperatures = variationConfig?.temperatures || [0.3, 0.7, 1.0];
          for (let i = 0; i < Math.min(candidatesPerCase, temperatures.length); i++) {
            try {
              const run = await this.generateRun(agent, case_, { temperature: temperatures[i] });
              const results = await this.scoreRun(scorers, run);
              const scorecard = createScorecard(run, results, scoring);
              scorecards.push(scorecard);
            } catch (error) {
              console.error(`Failed to generate/score case ${case_.id}:`, error);
            }
          }
        } else if (useOriginalOutputs) {
          // Use original outputs from trace - no regeneration needed!
          try {
            const run = this.caseToRun(case_);

            // Try to use existing scorer results if available
            const useExistingScores = (data as any).useExistingScores !== false;
            let results: ScorerResult[];

            if (useExistingScores && case_.metadata?.traceId && case_.metadata?.spanId) {
              const existingScores = await this.getExistingScores(
                case_.metadata.traceId as string,
                case_.metadata.spanId as string,
                scoring,
              );
              if (existingScores.length > 0) {
                results = existingScores;
              } else {
                results = await this.scoreRun(scorers, run);
              }
            } else {
              results = await this.scoreRun(scorers, run);
            }

            const scorecard = createScorecard(run, results, scoring);
            scorecards.push(scorecard);
          } catch (error) {
            console.error(`Failed to score case ${case_.id}:`, error);
          }
        } else {
          // Regenerate response with agent
          try {
            const run = await this.generateRun(agent, case_);
            const results = await this.scoreRun(scorers, run);
            const scorecard = createScorecard(run, results, scoring);
            scorecards.push(scorecard);
          } catch (error) {
            console.error(`Failed to generate/score case ${case_.id}:`, error);
          }
        }
        processedCount++;

        // Report progress every case (throttle to avoid too many updates)
        if (reportProgress && (processedCount % 5 === 0 || processedCount === totalCases)) {
          const percentage = Math.round((processedCount / totalCases) * 100);
          await reportProgress({
            stage: useOriginalOutputs ? 'scoring' : 'generating',
            stageLabel: `${stageLabel}: ${processedCount}/${totalCases} cases`,
            current: processedCount,
            total: totalCases,
            percentage,
          });
        }
      },
      { concurrency: useOriginalOutputs ? 10 : 5 }, // Higher concurrency when not making API calls
    );

    return scorecards;
  }

  /**
   * Convert a case directly to a run record (using original trace output).
   */
  private caseToRun(case_: AgentCase): AgentRunRecord {
    // Find the last assistant message as the output
    const assistantMessages = case_.messages.filter(m => m.role === 'assistant');
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    const outputText = lastAssistant?.content || '';

    return {
      caseId: case_.id,
      input: case_,
      outputText,
      outputMessages: case_.messages,
      toolCalls: lastAssistant?.toolCalls,
      timestamp: new Date(),
    };
  }

  /**
   * Generate a single run from a case.
   */
  private async generateRun(
    agent: Agent,
    case_: AgentCase,
    _options?: { temperature?: number },
  ): Promise<AgentRunRecord> {
    // Extract user messages for the prompt
    const userMessages = case_.messages.filter(m => m.role === 'user');
    const prompt = userMessages.map(m => m.content).join('\n');

    console.log(`[Trainer] Generating run for case ${case_.id}...`);
    const startTime = Date.now();

    // Generate response from agent
    const result = await agent.generate(prompt, {
      scorers: {}, // Disable automatic scoring, we'll do it manually
    });

    console.log(`[Trainer] Case ${case_.id} generated in ${Date.now() - startTime}ms`);

    return {
      caseId: case_.id,
      input: case_,
      outputText: result.text,
      outputMessages: [...case_.messages, { role: 'assistant' as const, content: result.text }],
      toolCalls: result.toolCalls?.map(tc => ({
        id: (tc as any).toolCallId || (tc as any).id || '',
        type: 'function' as const,
        function: {
          name: (tc as any).toolName || (tc as any).name || '',
          arguments: JSON.stringify((tc as any).args || (tc as any).arguments || {}),
        },
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Score a run using scorers.
   */
  private async scoreRun(scorers: Map<string, MastraScorer>, run: AgentRunRecord): Promise<ScorerResult[]> {
    const results: ScorerResult[] = [];

    // Convert to scorer-compatible format
    const scorerInput = convertToScorerInput(run.input);
    const scorerOutput = convertToScorerOutput(run.outputMessages);

    for (const [id, scorer] of scorers) {
      try {
        const result = await scorer.run({
          input: scorerInput,
          output: scorerOutput,
        });
        results.push({
          scorerId: id,
          scorerName: scorer.name,
          score: result.score,
          reason: result.reason,
        });
      } catch (error) {
        console.error(`Scorer ${id} failed:`, error);
        // Add zero score on failure
        results.push({
          scorerId: id,
          scorerName: scorer.name,
          score: 0,
          reason: `Scorer failed: ${error}`,
        });
      }
    }

    return results;
  }

  /**
   * Get existing scorer results from storage for a trace/span.
   */
  private async getExistingScores(
    traceId: string,
    spanId: string,
    scoring: FitAgentOptions['scoring'],
  ): Promise<ScorerResult[]> {
    if (!this.storage) {
      return [];
    }

    try {
      const scoresStore = await this.storage.getStore('scores');
      if (!scoresStore) {
        return [];
      }

      // Get all scorer IDs we care about
      const scorerIds = new Set([...Object.keys(scoring.composite), ...(scoring.gates?.map(g => g.scorerId) || [])]);

      // Fetch existing scores for this span
      const response = await scoresStore.listScoresBySpan({
        traceId,
        spanId,
        pagination: { page: 0, perPage: 100 },
      });

      // Filter to only the scorers we need
      const results: ScorerResult[] = [];
      for (const scoreRow of response.scores) {
        if (scorerIds.has(scoreRow.scorerId)) {
          results.push({
            scorerId: scoreRow.scorerId,
            scorerName: (scoreRow.scorer as any)?.name || scoreRow.scorerId,
            score: scoreRow.score,
            reason: scoreRow.reason,
          });
        }
      }

      // Only return if we have scores for ALL required scorers
      if (results.length >= scorerIds.size) {
        console.log(`[Trainer] Using ${results.length} existing scorer results for trace ${traceId}`);
        return results;
      }

      // If we're missing some scorers, return empty to trigger re-run
      if (results.length > 0) {
        console.log(`[Trainer] Found ${results.length}/${scorerIds.size} existing scores, will re-run scorers`);
      }
      return [];
    } catch (error) {
      console.warn(`[Trainer] Failed to fetch existing scores:`, error);
      return [];
    }
  }

  /**
   * Get scorers for training.
   */
  private async getScorers(_agent: Agent, scoring: FitAgentOptions['scoring']): Promise<Map<string, MastraScorer>> {
    const scorers = new Map<string, MastraScorer>();

    // Get scorer IDs from scoring config
    const scorerIds = Object.keys(scoring.composite);

    // Add gate scorers
    if (scoring.gates) {
      for (const gate of scoring.gates) {
        if (!scorerIds.includes(gate.scorerId)) {
          scorerIds.push(gate.scorerId);
        }
      }
    }

    // Resolve scorers from Mastra
    for (const id of scorerIds) {
      try {
        const scorer = this.mastra.getScorerById(id);
        scorers.set(id, scorer);
      } catch {
        console.warn(`Scorer ${id} not found in Mastra, skipping`);
      }
    }

    return scorers;
  }

  /**
   * Get a training job by ID.
   */
  async getJob(jobId: string): Promise<TrainingJob> {
    return this.provider.getJob(jobId);
  }

  /**
   * List training jobs, optionally filtered by agent.
   */
  async listJobs(agentId?: string): Promise<TrainingJob[]> {
    return this.provider.listJobs(agentId);
  }

  /**
   * Cancel a training job.
   */
  async cancelJob(jobId: string): Promise<void> {
    return this.provider.cancelJob(jobId);
  }

  /**
   * Wait for a job to complete.
   */
  async waitForJob(jobId: string, onProgress?: (job: TrainingJob) => void): Promise<TrainingJob> {
    if (this.provider.name === 'openai') {
      return (this.provider as any).waitForJob(jobId, onProgress);
    }

    // Generic polling fallback
    const pollInterval = 30000;
    const timeout = 3600000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await this.provider.getJob(jobId);

      if (onProgress) {
        onProgress(job);
      }

      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
        return job;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Job timed out after ${timeout}ms`);
  }

  /**
   * Get training statistics for rendered data.
   */
  getTrainingStats(method: string, data: Scorecard[]): Record<string, unknown> {
    switch (method) {
      case 'sft':
        return getSftStats(data);
      case 'dpo':
        return getDpoStats(data);
      default:
        return {};
    }
  }
}

/**
 * Create a new Trainer instance.
 */
export function createTrainer(options: TrainerOptions): Trainer {
  return new Trainer(options);
}
