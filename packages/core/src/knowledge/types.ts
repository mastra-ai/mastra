/**
 * Supported artifact types for Knowledge storage
 */
export type ArtifactType = 'file' | 'image' | 'text';

/**
 * Base artifact interface
 */
export interface Artifact {
  type: ArtifactType;
  key: string;
}

/**
 * File artifact - stores file content from a path or buffer
 */
export interface FileArtifact extends Artifact {
  type: 'file';
  content: Buffer | string;
}

/**
 * Image artifact - stores image data with optional metadata
 */
export interface ImageArtifact extends Artifact {
  type: 'image';
  content: Buffer | string;
  mimeType?: string;
}

/**
 * Text artifact - stores plain text content
 */
export interface TextArtifact extends Artifact {
  type: 'text';
  content: string;
}

export type AnyArtifact = FileArtifact | ImageArtifact | TextArtifact;
