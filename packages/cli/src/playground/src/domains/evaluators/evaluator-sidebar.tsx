import { GetEvaluatorResponse } from '@mastra/client-js';

export function EvaluatorSidebar({ evaluator }: { evaluator: GetEvaluatorResponse }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Evaluator Sidebar</h1>
      <h2>{evaluator.name}</h2>
    </div>
  );
}
