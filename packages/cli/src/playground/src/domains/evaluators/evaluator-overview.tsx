import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        <EvaluatorTemplate template={evaluator.evalTemplate} type="eval" />
        <EvaluatorTemplate template={evaluator.reasonTemplate} type="reason" />
        <EvaluatorSettings settings={evaluator.settings} />
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
      <p className="text-xs text-mastra-el-3">Model</p>
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
      <p className="text-xs text-mastra-el-3">Instructions</p>
      <Card className="text-sm">
        <CardContent className="p-4">
          <ScrollArea className="h-[200px]">
            <pre className="text-sm whitespace-pre-wrap">{instructions}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function EvaluatorTemplate({ template, type }: { template?: string; type: 'eval' | 'reason' }) {
  if (!template) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs capitalize text-mastra-el-3">{type} Template</p>
      <Card className="text-sm">
        <CardContent className="p-4">
          <ScrollArea className="h-[200px]">
            <pre className="text-sm whitespace-pre-wrap">{template}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function EvaluatorSettings({ settings }: { settings: GetEvaluatorResponse['settings'] }) {
  return (
    <div className="flex gap-2">
      <div>
        <p className="mb-2 text-xs text-mastra-el-3">Scale</p>
        <Badge variant="outline" className="h-8 w-[154px]">
          {settings.scale}
        </Badge>
      </div>
      <div>
        <p className="mb-2 text-xs text-mastra-el-3">Uncertainty Weight</p>
        <Badge variant="outline" className="h-8 w-[154px]">
          {settings.uncertaintyWeight}
        </Badge>
      </div>
    </div>
  );
}
