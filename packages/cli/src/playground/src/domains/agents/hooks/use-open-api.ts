import { useQuery } from '@tanstack/react-query';

export const useOpenApi = () => {
  return useQuery({
    queryKey: ['open-api'],
    queryFn: () => fetch('/openapi.json').then(res => res.json()),
  });
};
