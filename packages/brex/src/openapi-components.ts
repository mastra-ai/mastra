// @ts-nocheck
export type TComponents = {
  securitySchemes: {
    user_key: {
      in: 'header';
      name: 'user_key';
      type: 'apiKey';
    };
  };
};
export const components = {
  securitySchemes: {
    user_key: {
      in: 'header',
      name: 'user_key',
      type: 'apiKey',
    },
  },
} as TComponents;
