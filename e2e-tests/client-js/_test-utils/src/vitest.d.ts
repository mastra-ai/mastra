declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
