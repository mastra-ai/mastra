import type { LanguageModelV4FilePart, LanguageModelV4TextPart } from '@ai-sdk/provider';
import type { DataContent, ImagePart, FilePart } from '@internal/ai-v7';
import { convertToDataContent, detectMediaType, imageMediaTypeSignatures } from '../../../stream/aisdk/v5/compat';
import { anyToV4FileData, flattenFileData, toV4FileData } from '../../../stream/aisdk/v5/compat/content';

export function convertImageFilePart(
  part: ImagePart | FilePart,
  downloadedAssets?: Record<string, { mediaType: string | undefined; data: Uint8Array }>,
): LanguageModelV4TextPart | LanguageModelV4FilePart {
  const type = part.type;
  const source = type === 'image' ? part.image : type === 'file' ? part.data : undefined;
  if (source === undefined) {
    throw new Error(`Unsupported part type: ${type}`);
  }

  // v7 parts may carry tagged file data; inline data and URLs go through the normal path,
  // provider references and inline text pass through untouched.
  const flat = flattenFileData(source);
  if (flat === undefined) {
    return {
      type: 'file',
      mediaType: part.mediaType ?? (type === 'image' ? 'image/*' : 'application/octet-stream'),
      filename: type === 'file' ? part.filename : undefined,
      data: anyToV4FileData(source),
      providerOptions: part.providerOptions,
    };
  }
  const originalData: DataContent | URL = flat;

  const { data: convertedData, mediaType: convertedMediaType } = convertToDataContent(originalData);

  let mediaType: string | undefined = convertedMediaType ?? part.mediaType;
  let data: Uint8Array | string | URL = convertedData; // binary | base64 | url

  // If the content is a URL, we check if it was downloaded:
  if (data instanceof URL && downloadedAssets) {
    const downloadedFile = downloadedAssets[data.toString()];
    if (downloadedFile) {
      data = downloadedFile.data;
      mediaType ??= downloadedFile.mediaType;
    }
  }

  // Now that we have the normalized data either as a URL or a Uint8Array,
  // we can create the LanguageModelV4Content.
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
        data: toV4FileData(data),
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
        data: toV4FileData(data),
        providerOptions: part.providerOptions,
      };
    }
  }
}
