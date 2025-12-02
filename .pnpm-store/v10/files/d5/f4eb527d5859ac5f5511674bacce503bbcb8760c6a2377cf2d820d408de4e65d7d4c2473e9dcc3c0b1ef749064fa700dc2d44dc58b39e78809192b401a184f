/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * An immutable object representing a parsed path.  It's immutable so that you
 * can pass them around to other functions without worrying about them changing
 * it.
 */
export declare class Path {
    pieces_: string[];
    pieceNum_: number;
    /**
     * @param pathOrString - Path string to parse, or another path, or the raw
     * tokens array
     */
    constructor(pathOrString: string | string[], pieceNum?: number);
    toString(): string;
}
export declare function newEmptyPath(): Path;
export declare function pathGetFront(path: Path): string | null;
/**
 * @returns The number of segments in this path
 */
export declare function pathGetLength(path: Path): number;
export declare function pathPopFront(path: Path): Path;
export declare function pathGetBack(path: Path): string | null;
export declare function pathToUrlEncodedString(path: Path): string;
/**
 * Shallow copy of the parts of the path.
 *
 */
export declare function pathSlice(path: Path, begin?: number): string[];
export declare function pathParent(path: Path): Path | null;
export declare function pathChild(path: Path, childPathObj: string | Path): Path;
/**
 * @returns True if there are no segments in this path
 */
export declare function pathIsEmpty(path: Path): boolean;
/**
 * @returns The path from outerPath to innerPath
 */
export declare function newRelativePath(outerPath: Path, innerPath: Path): Path;
/**
 * @returns -1, 0, 1 if left is less, equal, or greater than the right.
 */
export declare function pathCompare(left: Path, right: Path): number;
/**
 * @returns true if paths are the same.
 */
export declare function pathEquals(path: Path, other: Path): boolean;
/**
 * @returns True if this path is a parent of (or the same as) other
 */
export declare function pathContains(path: Path, other: Path): boolean;
/**
 * Dynamic (mutable) path used to count path lengths.
 *
 * This class is used to efficiently check paths for valid
 * length (in UTF8 bytes) and depth (used in path validation).
 *
 * Throws Error exception if path is ever invalid.
 *
 * The definition of a path always begins with '/'.
 */
export declare class ValidationPath {
    errorPrefix_: string;
    parts_: string[];
    /** Initialize to number of '/' chars needed in path. */
    byteLength_: number;
    /**
     * @param path - Initial Path.
     * @param errorPrefix_ - Prefix for any error messages.
     */
    constructor(path: Path, errorPrefix_: string);
}
export declare function validationPathPush(validationPath: ValidationPath, child: string): void;
export declare function validationPathPop(validationPath: ValidationPath): void;
/**
 * String for use in error messages - uses '.' notation for path.
 */
export declare function validationPathToErrorString(validationPath: ValidationPath): string;
