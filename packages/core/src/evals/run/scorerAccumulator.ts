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
      if (!this.flatScores[scorerName]) {
        this.flatScores[scorerName] = [];
      }
      this.flatScores[scorerName].push((result as { score: number }).score);
    }
  }

  private addWorkflowScores(scorerResults: Record<string, any>) {
    if ('workflow' in scorerResults && scorerResults.workflow) {
      for (const [scorerName, result] of Object.entries(scorerResults.workflow)) {
        if (!this.workflowScores[scorerName]) {
          this.workflowScores[scorerName] = [];
        }
        this.workflowScores[scorerName].push((result as { score: number }).score);
      }
    }

    if ('steps' in scorerResults && scorerResults.steps) {
      for (const [stepId, stepResults] of Object.entries(scorerResults.steps)) {
        if (!this.stepScores[stepId]) {
          this.stepScores[stepId] = {};
        }
        for (const [scorerName, result] of Object.entries(stepResults as Record<string, any>)) {
          if (!this.stepScores[stepId][scorerName]) {
            this.stepScores[stepId][scorerName] = [];
          }
          this.stepScores[stepId][scorerName].push((result as { score: number }).score);
        }
      }
    }

    // Trajectory scores can come from workflow scorer configs too
    if ('trajectory' in scorerResults && scorerResults.trajectory) {
      for (const [scorerName, result] of Object.entries(scorerResults.trajectory)) {
        if (!this.trajectoryScores[scorerName]) {
          this.trajectoryScores[scorerName] = [];
        }
        this.trajectoryScores[scorerName].push((result as { score: number }).score);
      }
    }
  }

  private addAgentScores(scorerResults: Record<string, any>) {
    if ('agent' in scorerResults && scorerResults.agent) {
      for (const [scorerName, result] of Object.entries(scorerResults.agent)) {
        if (!this.agentScores[scorerName]) {
          this.agentScores[scorerName] = [];
        }
        this.agentScores[scorerName].push((result as { score: number }).score);
      }
    }

    if ('trajectory' in scorerResults && scorerResults.trajectory) {
      for (const [scorerName, result] of Object.entries(scorerResults.trajectory)) {
        if (!this.trajectoryScores[scorerName]) {
          this.trajectoryScores[scorerName] = [];
        }
        this.trajectoryScores[scorerName].push((result as { score: number }).score);
      }
    }
  }

  addStepScores(stepScorerResults: Record<string, Record<string, any>>) {
    for (const [stepId, stepResults] of Object.entries(stepScorerResults)) {
      if (!this.stepScores[stepId]) {
        this.stepScores[stepId] = {};
      }
      for (const [scorerName, result] of Object.entries(stepResults)) {
        if (!this.stepScores[stepId][scorerName]) {
          this.stepScores[stepId][scorerName] = [];
        }
        this.stepScores[stepId][scorerName].push((result as { score: number }).score);
      }
    }
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
