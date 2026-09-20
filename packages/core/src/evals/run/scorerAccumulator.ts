/**
 * Collects scorer results across data items and averages them per scorer.
 *
 * A result the scorer declared not scorable (no `score`, `notScorable` set)
 * is counted separately and left out of the average, so an inapplicable run
 * neither inflates nor deflates a scorer's score. A scorer whose every run
 * was not scorable is omitted from `getAverageScores()` rather than reported
 * as 0.
 */
export class ScoreAccumulator {
  private flatScores: Record<string, number[]> = {};
  private workflowScores: Record<string, number[]> = {};
  private stepScores: Record<string, Record<string, number[]>> = {};
  private agentScores: Record<string, number[]> = {};
  private trajectoryScores: Record<string, number[]> = {};
  private notScorableCounts: Record<string, number> = {};

  addScores(scorerResults: Record<string, any>) {
    const isWorkflowScores = 'steps' in scorerResults || 'workflow' in scorerResults;
    const isAgentScores = 'agent' in scorerResults;
    const hasTrajectory = 'trajectory' in scorerResults;

    // Routing priority: workflow configs take precedence (they may also include
    // trajectory scores), then agent configs (agent or trajectory-only), then
    // flat scores for simple scorer arrays.
    if (isWorkflowScores) {
      this.addWorkflowScores(scorerResults);
    } else if (isAgentScores || hasTrajectory) {
      this.addAgentScores(scorerResults);
    } else {
      this.addFlatScores(scorerResults);
    }
  }

  private addFlatScores(scorerResults: Record<string, any>) {
    for (const [scorerName, result] of Object.entries(scorerResults)) {
      this.pushScore(this.flatScores, scorerName, result);
    }
  }

  private addWorkflowScores(scorerResults: Record<string, any>) {
    if ('workflow' in scorerResults && scorerResults.workflow) {
      for (const [scorerName, result] of Object.entries(scorerResults.workflow)) {
        this.pushScore(this.workflowScores, scorerName, result);
      }
    }

    if ('steps' in scorerResults && scorerResults.steps) {
      this.addStepScores(scorerResults.steps);
    }

    // Trajectory scores can come from workflow scorer configs too
    if ('trajectory' in scorerResults && scorerResults.trajectory) {
      for (const [scorerName, result] of Object.entries(scorerResults.trajectory)) {
        this.pushScore(this.trajectoryScores, scorerName, result);
      }
    }
  }

  private addAgentScores(scorerResults: Record<string, any>) {
    if ('agent' in scorerResults && scorerResults.agent) {
      for (const [scorerName, result] of Object.entries(scorerResults.agent)) {
        this.pushScore(this.agentScores, scorerName, result);
      }
    }

    if ('trajectory' in scorerResults && scorerResults.trajectory) {
      for (const [scorerName, result] of Object.entries(scorerResults.trajectory)) {
        this.pushScore(this.trajectoryScores, scorerName, result);
      }
    }
  }

  addStepScores(stepScorerResults: Record<string, Record<string, any>>) {
    for (const [stepId, stepResults] of Object.entries(stepScorerResults)) {
      for (const [scorerName, result] of Object.entries(stepResults)) {
        const score = this.classify(scorerName, result);
        if (score === undefined) continue;
        ((this.stepScores[stepId] ??= {})[scorerName] ??= []).push(score);
      }
    }
  }

  private pushScore(buckets: Record<string, number[]>, scorerName: string, result: unknown) {
    const score = this.classify(scorerName, result);
    if (score === undefined) return;
    (buckets[scorerName] ??= []).push(score);
  }

  /**
   * Returns the numeric score of a result, or `undefined` when the result
   * carries none. Not-scorable results are counted as they pass through.
   */
  private classify(scorerName: string, result: unknown): number | undefined {
    if (typeof result !== 'object' || result === null) return undefined;
    const { score, notScorable } = result as { score?: unknown; notScorable?: unknown };
    if (notScorable) {
      this.notScorableCounts[scorerName] = (this.notScorableCounts[scorerName] ?? 0) + 1;
      return undefined;
    }
    return typeof score === 'number' ? score : undefined;
  }

  /** Not-scorable result counts keyed by scorer id, across every result shape. */
  getNotScorableCounts(): Record<string, number> {
    return { ...this.notScorableCounts };
  }

  getAverageScores(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [scorerName, scoreArray] of Object.entries(this.flatScores)) {
      result[scorerName] = this.getAverageScore(scoreArray);
    }

    // Add workflow scores
    if (Object.keys(this.workflowScores).length > 0) {
      result.workflow = {};
      for (const [scorerName, scoreArray] of Object.entries(this.workflowScores)) {
        result.workflow[scorerName] = this.getAverageScore(scoreArray);
      }
    }

    if (Object.keys(this.stepScores).length > 0) {
      result.steps = {};
      for (const [stepId, stepScorers] of Object.entries(this.stepScores)) {
        result.steps[stepId] = {};
        for (const [scorerName, scoreArray] of Object.entries(stepScorers)) {
          result.steps[stepId][scorerName] = this.getAverageScore(scoreArray);
        }
      }
    }

    // Add agent scores
    if (Object.keys(this.agentScores).length > 0) {
      result.agent = {};
      for (const [scorerName, scoreArray] of Object.entries(this.agentScores)) {
        result.agent[scorerName] = this.getAverageScore(scoreArray);
      }
    }

    // Add trajectory scores
    if (Object.keys(this.trajectoryScores).length > 0) {
      result.trajectory = {};
      for (const [scorerName, scoreArray] of Object.entries(this.trajectoryScores)) {
        result.trajectory[scorerName] = this.getAverageScore(scoreArray);
      }
    }

    return result;
  }

  private getAverageScore(scoreArray: number[]): number {
    if (scoreArray.length > 0) {
      return scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
    } else {
      return 0;
    }
  }
}
