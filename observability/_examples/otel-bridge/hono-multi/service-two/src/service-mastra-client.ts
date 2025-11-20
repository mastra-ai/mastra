export const serviceMastraClient = {
  getMessage: async (url: string): Promise<{ message: string; traceId: string }> => {
    const response = await fetch(`${url}/service-mastra`);
    return response.json() as Promise<{ message: string; traceId: string }>;
  },
};
