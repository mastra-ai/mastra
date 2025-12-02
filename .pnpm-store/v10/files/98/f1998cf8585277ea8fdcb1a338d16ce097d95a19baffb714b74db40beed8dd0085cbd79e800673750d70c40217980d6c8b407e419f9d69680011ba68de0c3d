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
export declare class DefaultGeneratedFile implements GeneratedFile {
    private base64Data;
    private uint8ArrayData;
    readonly mediaType: string;
    constructor({ data, mediaType }: {
        data: string | Uint8Array;
        mediaType: string;
    });
    get base64(): string;
    get uint8Array(): Uint8Array<ArrayBufferLike>;
}
export declare class DefaultGeneratedFileWithType extends DefaultGeneratedFile {
    readonly type = "file";
    constructor(options: {
        data: string | Uint8Array;
        mediaType: string;
    });
}
//# sourceMappingURL=file.d.ts.map