/**
 * @internal
 *
 * A FileBlob is a replacement for the Blob class that allows to lazy read files
 * in order to preserve memory.
 *
 * It is a drop-in replacement for the Blob class, so you can use it as a Blob.
 *
 * The main difference is the instantiation, which is done asynchronously using the `FileBlob.create` method.
 *
 * @example
 * const fileBlob = await FileBlob.create("path/to/package.json");
 *
 * await fetch("https://aschen.tech", { method: "POST", body: fileBlob });
 */
export declare class FileBlob extends Blob {
    /**
     * Creates a new FileBlob on the provided file.
     *
     * @param path Path to the file to be lazy readed
     */
    static create(path: string | URL): Promise<FileBlob>;
    private path;
    private start;
    private end;
    private constructor();
    /**
     * Returns the size of the blob.
     */
    get size(): number;
    /**
     * Returns a new instance of FileBlob that is a slice of the current one.
     *
     * The slice is inclusive of the start and exclusive of the end.
     *
     * The slice method does not supports negative start/end.
     *
     * @param start beginning of the slice
     * @param end end of the slice
     */
    slice(start?: number, end?: number): FileBlob;
    /**
     * Read the part of the file delimited by the FileBlob and returns it as an ArrayBuffer.
     */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * Read the part of the file delimited by the FileBlob and returns it as a string.
     */
    text(): Promise<string>;
    /**
     * Returns a stream around the part of the file delimited by the FileBlob.
     */
    stream(): ReturnType<Blob["stream"]>;
    /**
     * We are opening and closing the file for each action to prevent file descriptor leaks.
     *
     * It is an intended choice of developer experience over performances.
     */
    private execute;
}
//# sourceMappingURL=FileBlob.d.ts.map