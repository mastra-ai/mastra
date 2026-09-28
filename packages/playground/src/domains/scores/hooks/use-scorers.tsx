import { useScorers as useScorersBase } from '@mastra/playground-ui/domains/scores';
import { useMergedRequestContext } from '@/domains/request-context';

export const useScorers = (options?: { enabled?: boolean }) => {
  const requestContext = useMergedRequestContext();
  return useScorersBase({ ...options, requestContext });
};
