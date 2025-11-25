export const serviceMastraClient = {
  getMessage: async (url: string): Promise<{ message: string; traceId: string }> => {
    const response = await fetch(`${url}/service-mastra`);

    if (!response.ok) {
      throw new Error(`service-mastra request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { message: string; traceId: string };

    if (!data.message || !data.traceId) {
      throw new Error('Invalid response structure from service-mastra');
    }

    return data as { message: string; traceId: string };
  },
};
