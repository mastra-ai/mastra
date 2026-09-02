export class ScoreAccumulator {
  private flatScores: Record<string, number[]> = {};
  private workflowScores: Record<string, number[]> = {};
  private stepScores: Record<string, Record<string, number[]>> = {};
  private agentScores: Record<string, number[]> = {};
  private trajectoryScores: Record<string, number[]> = {};

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
      for (const [stepId, stepResults] of Object.entries(scorerResults.steps)) {
        for (const [scorerName, result] of Object.entries(stepResults as Record<string, any>)) {
          this.pushStepScore(stepId, scorerName, result);
        }
      }
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
        this.pushStepScore(stepId, scorerName, result);
      }
    }
  }

  // Buckets are created on the first numeric score, so all-excluded scorers are omitted rather than averaged to 0
  private pushScore(buckets: Record<string, number[]>, scorerName: string, result: unknown) {
    const score = (result as { score?: unknown } | null | undefined)?.score;
    if (typeof score !== 'number') return;
    (buckets[scorerName] ??= []).push(score);
  }

  private pushStepScore(stepId: string, scorerName: string, result: unknown) {
    const score = (result as { score?: unknown } | null | undefined)?.score;
    if (typeof score !== 'number') return;
    ((this.stepScores[stepId] ??= {})[scorerName] ??= []).push(score);
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
