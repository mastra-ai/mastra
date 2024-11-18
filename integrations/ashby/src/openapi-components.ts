// @ts-nocheck
export type TComponents = {
  securitySchemes: {
    BasicAuth: {
      type: 'http';
      scheme: 'basic';
      description: 'Use HTTP Basic Auth to authenticate with our API. You must send your API key with every request. \nPut your API key as the basic auth username and leave the password blank.\n';
    };
    WebhookSignature: {
      type: 'apiKey';
      in: 'header';
      name: 'Ashby-Signature';
      description: '[Optional] If you provide a secret token when configuring your webhook, this will be used to create a digest of the JSON payload sent with each webhook request.\nThe digest will be included in the request under the `Ashby-Signature` http header.\n\nIt will look like this:\n`Ashby-Signature: sha256=f3124911d2956f10aa3a49c43a88bdf13bba846e94f0ae2bd7c034f90239bd04`\n\nThe part before the = indicates the algorithm that was used to compute the hash digest.\n';
    };
  };
};
export const components = {
  securitySchemes: {
    BasicAuth: {
      type: 'http',
      scheme: 'basic',
      description:
        'Use HTTP Basic Auth to authenticate with our API. You must send your API key with every request. \nPut your API key as the basic auth username and leave the password blank.\n',
    },
    WebhookSignature: {
      type: 'apiKey',
      in: 'header',
      name: 'Ashby-Signature',
      description:
        '[Optional] If you provide a secret token when configuring your webhook, this will be used to create a digest of the JSON payload sent with each webhook request.\nThe digest will be included in the request under the `Ashby-Signature` http header.\n\nIt will look like this:\n`Ashby-Signature: sha256=f3124911d2956f10aa3a49c43a88bdf13bba846e94f0ae2bd7c034f90239bd04`\n\nThe part before the = indicates the algorithm that was used to compute the hash digest.\n',
    },
  },
} as TComponents;
