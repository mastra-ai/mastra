import { LLMProviders, LLMModels } from '@/domains/llm';
import { usePlaygroundModel } from '../../context/playground-model-context';

export function PlaygroundModelSelector() {
  const { provider, model, setProvider, setModel } = usePlaygroundModel();

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[140px]">
        <LLMProviders
          value={provider}
          onValueChange={value => {
            setProvider(value);
            setModel('');
          }}
          size="sm"
        />
      </div>
      <div className="w-[180px]">
        <LLMModels llmId={provider} value={model} onValueChange={setModel} size="sm" />
      </div>
    </div>
  );
}
