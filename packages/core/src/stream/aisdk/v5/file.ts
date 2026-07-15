import { convertBase64ToUint8Array, convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils-v5';
import { isUrlString } from './compat/content';

/**
 * A generated file.
 */
export interface GeneratedFile {
  /**
  File as a base64 encoded string.
       */
  readonly base64: string;

  /**
  File as a Uint8Array.
       */
  readonly uint8Array: Uint8Array;

  /**
  The IANA media type of the file.
  
  @see https://www.iana.org/assignments/media-types/media-types.xhtml
     */
  readonly mediaType: string;
}

export class DefaultGeneratedFile implements GeneratedFile {
  private base64Data: string | undefined;
  private uint8ArrayData: Uint8Array | undefined;

  readonly mediaType: string;

  constructor({ data, mediaType }: { data: string | Uint8Array; mediaType: string }) {
    const isUint8Array = data instanceof Uint8Array;
    this.base64Data = isUint8Array ? undefined : data;
    this.uint8ArrayData = isUint8Array ? data : undefined;
    this.mediaType = mediaType;
  }

  // lazy conversion with caching to avoid unnecessary conversion overhead:
  get base64() {
    if (this.base64Data == null) {
      this.base64Data = convertUint8ArrayToBase64(this.uint8ArrayData!);
    }
    return this.base64Data;
  }

  // lazy conversion with caching to avoid unnecessary conversion overhead:
  get uint8Array() {
    if (this.uint8ArrayData == null) {
      // URL-backed generated files (AI SDK v7 models) store the URL string in
      // place of base64. Fail loudly instead of decoding the URL as base64.
      if (isUrlString(this.base64Data!)) {
        throw new Error(
          `Cannot convert URL-backed generated file to Uint8Array. Download the file from ${this.base64Data} instead.`,
        );
      }
      this.uint8ArrayData = convertBase64ToUint8Array(this.base64Data!);
    }
    return this.uint8ArrayData;
  }
}

export class DefaultGeneratedFileWithType extends DefaultGeneratedFile {
  readonly type = 'file';

  constructor(options: { data: string | Uint8Array; mediaType: string }) {
    super(options);
  }
}
