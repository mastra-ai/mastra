export default {
  client: '@hey-api/client-fetch',
  input: '../src/openapi.json',
  output: '../src/generated',
  hooks: {
    // You can add hooks here to modify the generated code
    'after:generate': context => {
      // Custom post-generation logic if needed
    },
  },
  // Configure the client generation
  clientConfig: {
    // Add any specific client configuration here
    bundle: false, // Set to true if you want to bundle the client code
  },
};
