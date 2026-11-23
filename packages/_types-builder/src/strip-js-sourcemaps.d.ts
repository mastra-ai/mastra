export function stripJsSourcemaps(): {
  name: string;
  generateBundle(options: unknown, bundle: Record<string, any>): void;
};
