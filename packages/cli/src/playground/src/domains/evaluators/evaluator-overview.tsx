import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { providerMapToIcon } from '@/pages/agents';
import { GetEvaluatorResponse } from '@mastra/client-js';

export function EvaluatorOverview({ evaluator, id }: { evaluator: GetEvaluatorResponse; id: string }) {
  return (
    <div className="p-14">
      <EvaluatorTypeBadge type={evaluator.type} />
      <EvaluatorName name={id} />

      <section className="flex flex-col gap-6 mt-12">
        <EvaluatorModel modelId={evaluator.modelId} provider={evaluator.provider} />
        <EvaluatorInstruction instructions={evaluator.instructions} />
        <EvaluatorSettings />
      </section>
    </div>
  );
}

function EvaluatorTypeBadge({ type }: { type: GetEvaluatorResponse['type'] }) {
  // return "LLM"
  switch (type) {
    case 'llm':
      return <Badge variant="secondary">LLM as a Judge</Badge>;
    case 'scoring':
      return <Badge variant="secondary">Scoring</Badge>;
    default:
      return <Badge variant="secondary">👀</Badge>;
  }
}

function EvaluatorName({ name }: { name: string }) {
  return <h1 className="mt-4 text-2xl font-medium">{name}</h1>;
}

function EvaluatorModel({ modelId, provider }: { modelId: string; provider: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-mastra-el-5">Model</p>
      <Badge variant="outline" className="flex items-center w-full h-8 gap-2">
        <span>{providerMapToIcon[provider as keyof typeof providerMapToIcon] ?? null}</span>
        <span>{modelId}</span>
      </Badge>
    </div>
  );
}

function EvaluatorInstruction({ instructions }: { instructions: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-mastra-el-5">Instructions</p>
      <Input value={instructions} variant="filled" className="text-sm" disabled />
    </div>
  );
}

function EvaluatorSettings() {
  return <div>EvaluatorSettings</div>;
}
