export function compileSchema<T>(schema: T): T;

declare function esbuildCompileZod(): {
  name: string;
  setup(build: any): void;
};

export default esbuildCompileZod;
