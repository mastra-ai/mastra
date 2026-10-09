import { useScorers as useScorersBase } from '@mastra/react/hooks/scores';

export const useScorers = (options?: { enabled?: boolean }, requestContext?: Record<string, any>) => {
  return useScorersBase({ ...options, requestContext });
};
