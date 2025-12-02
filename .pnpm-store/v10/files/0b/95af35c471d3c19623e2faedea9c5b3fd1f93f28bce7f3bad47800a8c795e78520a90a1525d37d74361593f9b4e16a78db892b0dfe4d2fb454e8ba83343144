import { type DescExtension, type DescField, type DescMessage, type DescOneof } from "../descriptors.js";
import type { Registry } from "../registry.js";
/**
 * A path to a (nested) member of a Protobuf message, such as a field, oneof,
 * extension, list element, or map entry.
 *
 * Note that we may add additional types to this union in the future to support
 * more use cases.
 */
export type Path = (DescField | DescExtension | DescOneof | {
    kind: "list_sub";
    index: number;
} | {
    kind: "map_sub";
    key: string | number | bigint | boolean;
})[];
/**
 * Builds a Path.
 */
export type PathBuilder = {
    /**
     * The root message of the path.
     */
    readonly schema: DescMessage;
    /**
     * Add field access.
     *
     * Throws an InvalidPathError if the field cannot be added to the path.
     */
    field(field: DescField): PathBuilder;
    /**
     * Access a oneof.
     *
     * Throws an InvalidPathError if the oneof cannot be added to the path.
     *
     */
    oneof(oneof: DescOneof): PathBuilder;
    /**
     * Access an extension.
     *
     * Throws an InvalidPathError if the extension cannot be added to the path.
     */
    extension(extension: DescExtension): PathBuilder;
    /**
     * Access a list field by index.
     *
     * Throws an InvalidPathError if the list access cannot be added to the path.
     */
    list(index: number): PathBuilder;
    /**
     * Access a map field by key.
     *
     * Throws an InvalidPathError if the map access cannot be added to the path.
     */
    map(key: string | number | bigint | boolean): PathBuilder;
    /**
     * Append a path.
     *
     * Throws an InvalidPathError if the path cannot be added.
     */
    add(path: Path | PathBuilder): PathBuilder;
    /**
     * Return the path.
     */
    toPath(): Path;
    /**
     * Create a copy of this builder.
     */
    clone(): PathBuilder;
    /**
     * Get the current container - a list, map, or message.
     */
    getLeft(): DescMessage | (DescField & {
        fieldKind: "list";
    }) | (DescField & {
        fieldKind: "map";
    }) | undefined;
};
/**
 * Create a PathBuilder.
 */
export declare function buildPath(schema: DescMessage): PathBuilder;
/**
 * Parse a Path from a string.
 *
 * Throws an InvalidPathError if the path is invalid.
 *
 * Note that a Registry must be provided via the options argument to parse
 * paths that refer to an extension.
 */
export declare function parsePath(schema: DescMessage, path: string, options?: {
    registry?: Registry;
}): Path;
/**
 * Stringify a path.
 */
export declare function pathToString(path: Path): string;
/**
 * InvalidPathError is thrown for invalid Paths, for example during parsing from
 * a string, or when a new Path is built.
 */
export declare class InvalidPathError extends Error {
    name: string;
    readonly schema: DescMessage;
    readonly path: Path | string;
    constructor(schema: DescMessage, message: string, path: string | Path);
}
