export class ScoreAccumulator {
  private flatScores: Record<string, number[]> = {};
  private workflowScores: Record<string, number[]> = {};
  private stepScores: Record<string, Record<string, number[]>> = {};

  addScores(scorerResults: Record<string, any>) {
    const isTargetWorkflowAndHasStepScores = 'steps' in scorerResults;
    if (isTargetWorkflowAndHasStepScores) {
      this.addNestedScores(scorerResults);
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

  private addNestedScores(scorerResults: Record<string, any>) {
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
