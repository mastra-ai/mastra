export const serviceTwoClient = {
  getMessage: async (url: string): Promise<{ message: string }> => {
    const response = await fetch(`${url}/service-two`);
    return response.json() as Promise<{ message: string }>;
  },
};
