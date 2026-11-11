import type { AdmissionIdentity } from './accounting.js';
export interface ArtifactReader {
  read(
    identity: AdmissionIdentity,
    artifactId: string,
  ): Promise<{ bytes: Uint8Array; filename: string; mime: string } | null>;
}
