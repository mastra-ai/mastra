export const serviceMastraClient = {
  getMessage: async (url: string): Promise<{ message: string }> => {
    const response = await fetch(`${url}/service-mastra`);
    return response.json() as Promise<{ message: string }>;
  },
};
