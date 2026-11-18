declare const plugin: {
  meta: { name: string };
  rules: Record<string, { meta: object; create: (context: unknown) => object }>;
};
export declare const recommended: Record<string, 'error'>;
export declare const copyRules: Record<string, 'error'>;
export declare const copyRuleExclusions: {
  files: string[];
  rules: Record<string, 'off'>;
};
export default plugin;
