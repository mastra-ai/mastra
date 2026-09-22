import { documentExtractionPromptV1 } from './document-extraction-v1.js';
import { documentExtractionPromptV2 } from './document-extraction-v2.js';

export const loadDocumentExtractionPrompt = (version = '1.1.0') => {
  if (version === documentExtractionPromptV1.version) return documentExtractionPromptV1;
  if (version === documentExtractionPromptV2.version) return documentExtractionPromptV2;
  throw new Error(`Unknown document extraction prompt version: ${version}`);
};
