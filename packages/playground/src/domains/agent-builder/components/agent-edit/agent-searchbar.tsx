import type { SearchbarProps } from '@mastra/playground-ui/components/Searchbar';
import { Searchbar } from '@mastra/playground-ui/components/Searchbar';

export const AgentSearchbar = (props: SearchbarProps) => {
  return <Searchbar {...props} className="bg-surface3" />;
};
