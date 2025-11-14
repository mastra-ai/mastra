import type { DataContent, ImagePart, FilePart } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2FilePart, LanguageModelV2TextPart } from '@ai-sdk/provider-v5';
import { convertToDataContent, detectMediaType, imageMediaTypeSignatures } from '../../../stream/aisdk/v5/compat';

export function convertImageFilePart(
  part: ImagePart | FilePart,
  downloadedAssets: Record<string, { mediaType: string | undefined; data: Uint8Array }>,
): LanguageModelV2TextPart | LanguageModelV2FilePart {
  let originalData: DataContent | URL;
  const type = part.type;
  switch (type) {
    case 'image':
      originalData = part.image;
      break;
    case 'file':
      originalData = part.data;

      break;
    default:
      throw new Error(`Unsupported part type: ${type}`);
  }

  const { data: convertedData, mediaType: convertedMediaType } = convertToDataContent(originalData);

  let mediaType: string | undefined = convertedMediaType ?? part.mediaType;
  let data: Uint8Array | string | URL = convertedData; // binary | base64 | url

  // If the content is a URL, we check if it was downloaded:
  if (data instanceof URL) {
    const downloadedFile = downloadedAssets[data.toString()];
    if (downloadedFile) {
      data = downloadedFile.data;
      mediaType ??= downloadedFile.mediaType;
    }
  }

  // Now that we have the normalized data either as a URL or a Uint8Array,
  // we can create the LanguageModelV2Part.
  switch (type) {
    case 'image': {
      // When possible, try to detect the media type automatically
      // to deal with incorrect media type inputs.
      // When detection fails, use provided media type.
      if (data instanceof Uint8Array || typeof data === 'string') {
        mediaType = detectMediaType({ data, signatures: imageMediaTypeSignatures }) ?? mediaType;
      }

      return {
        type: 'file',
        mediaType: mediaType ?? 'image/*', // any image
        filename: undefined,
        data,
        providerOptions: part.providerOptions,
      };
    }

    case 'file': {
      // We must have a mediaType for files, if not, throw an error.
      if (mediaType == null) {
        throw new Error(`Media type is missing for file part`);
      }

      return {
        type: 'file',
        mediaType,
        filename: part.filename,
        data,
        providerOptions: part.providerOptions,
      };
    }
  }
}
