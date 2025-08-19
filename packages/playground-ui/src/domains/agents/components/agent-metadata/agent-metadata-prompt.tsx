import { Txt } from '@/ds/components/Txt';

export interface AgentMetadataPromptProps {
  prompt: string;
}

export const AgentMetadataPrompt = ({ prompt }: AgentMetadataPromptProps) => {
  return (
    <Txt as="p" variant="ui-md" className="bg-surface4 text-icon6 whitespace-pre-wrap rounded-lg px-2 py-1.5 text-sm">
      {prompt}
    </Txt>
  );
};
