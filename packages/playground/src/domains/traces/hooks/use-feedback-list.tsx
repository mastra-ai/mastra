import type { ListFeedbackArgs } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

const FEEDBACK_LIST_PER_PAGE = 25;

type UseFeedbackListProps = {
  filters?: ListFeedbackArgs['filters'];
  page?: number;
};

export const useFeedbackList = ({ filters, page = 0 }: UseFeedbackListProps) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['feedback-list', filters, page],
    queryFn: () =>
      client.listFeedback({
        filters,
        pagination: { page, perPage: FEEDBACK_LIST_PER_PAGE },
      }),
  });
};
