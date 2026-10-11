import type { Interpretation } from '../../contracts/answer.ts';
import type { CanonicalQuestion } from '../../contracts/question.ts';
import type { ProcessingStore } from '../../persistence/processing.ts';
import type { QuestionEnvironment } from '../../processing/answers.ts';
import type { ModelFactory } from '../../processing/model.ts';

export interface DraftWorkflowOptions {
  databaseUrl?: string;
  runtimeRoot?: string;
  models?: ModelFactory;
}

export interface DraftRunSession {
  environment: QuestionEnvironment;
  questions: CanonicalQuestion[];
  interpretations: Map<string, Interpretation>;
}

export interface DraftWorkflowRuntime {
  options: DraftWorkflowOptions;
  sessions: Map<string, DraftRunSession>;
  stores: Map<string, ProcessingStore>;
  workflowOwners: Map<string, string>;
}

export function closeDraftRun(runtime: DraftWorkflowRuntime, intakeRunId: string) {
  runtime.stores.get(intakeRunId)?.close();
  runtime.stores.delete(intakeRunId);
  runtime.sessions.delete(intakeRunId);
  runtime.workflowOwners.delete(intakeRunId);
}
