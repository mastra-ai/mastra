declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
    registryMode: 'local' | 'published';
    registryArtifactDigest: string | null;
    runRoot: string;
    artifactRoot: string;
    reportRoot: string;
  }
}

export {};
