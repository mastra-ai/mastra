declare const plugin: {
  meta: { name: string };
  rules: Record<string, { meta: object; create: (context: unknown) => object }>;
};
export declare const recommended: Record<string, 'error'>;
export default plugin;
