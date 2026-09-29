import { useScorers as useScorersBase } from '@mastra/playground-ui/domains/scores';

export const useScorers = (options?: { enabled?: boolean }, requestContext?: Record<string, any>) => {
  return useScorersBase({ ...options, requestContext });
};
