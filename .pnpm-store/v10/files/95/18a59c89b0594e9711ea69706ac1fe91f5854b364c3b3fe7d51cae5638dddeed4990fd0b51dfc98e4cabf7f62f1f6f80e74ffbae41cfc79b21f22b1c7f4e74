interface TextEncoding {
    /**
     * Verify that the given text is valid UTF-8.
     */
    checkUtf8: (text: string) => boolean;
    /**
     * Encode UTF-8 text to binary.
     */
    encodeUtf8: (text: string) => Uint8Array<ArrayBuffer>;
    /**
     * Decode UTF-8 text from binary.
     */
    decodeUtf8: (bytes: Uint8Array) => string;
}
/**
 * Protobuf-ES requires the Text Encoding API to convert UTF-8 from and to
 * binary. This WHATWG API is widely available, but it is not part of the
 * ECMAScript standard. On runtimes where it is not available, use this
 * function to provide your own implementation.
 *
 * Note that the Text Encoding API does not provide a way to validate UTF-8.
 * Our implementation falls back to use encodeURIComponent().
 */
export declare function configureTextEncoding(textEncoding: TextEncoding): void;
export declare function getTextEncoding(): TextEncoding;
export {};
