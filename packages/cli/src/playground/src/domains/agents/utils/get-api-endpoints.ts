import { ApiEndpoint } from '@/types';

export const getApiEndpoints = (data: any) => {
  const endpoints: ApiEndpoint[] = [];

  Object.keys(data).forEach(endpoint => {
    const endpointData = data[endpoint];
    const methods = Object.keys(endpointData);

    methods.forEach(method => {
      const methodData = endpointData[method];

      if (!methodData.description.toLowerCase().includes('deprecated')) {
        endpoints.push({
          endpoint,
          description: methodData.description,
          method,
          parameters: methodData.parameters,
          body: methodData?.requestBody?.content['application/json']?.schema,
          tags: methodData.tags,
        });
      }
    });
  });

  return endpoints;
};
