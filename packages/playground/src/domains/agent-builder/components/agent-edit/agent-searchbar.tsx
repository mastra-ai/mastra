import type { SearchbarProps } from '@mastra/playground-ui';
import { Searchbar } from '@mastra/playground-ui';

export const AgentSearchbar = (props: SearchbarProps) => {
  return <Searchbar {...props} className="bg-surface3" />;
};
