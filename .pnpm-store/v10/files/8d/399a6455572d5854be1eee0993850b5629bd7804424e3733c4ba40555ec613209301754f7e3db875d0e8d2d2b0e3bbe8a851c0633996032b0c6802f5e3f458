/**
 * Read an expected JSON type File.
 *
 * Probably paired with:
 *  <input type='file' accept='application/JSON' ... />
 */
declare function readJSONFile(file: File): Promise<unknown>;
declare const MimeTypeToExtensionMap: Readonly<{
    readonly 'image/png': "png";
    readonly 'image/jpeg': "jpg";
    readonly 'image/gif': "gif";
    readonly 'image/webp': "webp";
    readonly 'image/x-icon': "ico";
    readonly 'image/vnd.microsoft.icon': "ico";
}>;
type SupportedMimeType = keyof typeof MimeTypeToExtensionMap;
declare const extension: (mimeType: SupportedMimeType) => string;

export { type SupportedMimeType, extension, readJSONFile };
