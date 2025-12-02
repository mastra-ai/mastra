/**
 * Defines a coordinate in 2D space.
 * @class Coordinate
 * Added in version 1.33.0
 */
export declare class Coordinate {
    x: number;
    y: number;
    constructor(x: number, y: number);
}
/**
 * Defines the avatar output video format.
 * @class AvatarVideoFormat
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change in the future.
 */
export declare class AvatarVideoFormat {
    /**
     * Defines the video codec.
     * @default "H264"
     */
    codec: string;
    /**
     * Defines the video bitrate.
     * @default 2000000
     */
    bitrate: number;
    /**
     * Defines the video width.
     * @default 1920
     */
    width: number;
    /**
     * Defines the video height.
     * @default 1080
     */
    height: number;
    /**
     * Sets the video crop range.
     */
    setCropRange(topLeft: Coordinate, bottomRight: Coordinate): void;
    /**
     * Defines the video crop range.
     * @default undefined
     * @internal
     */
    cropRange: {
        topLeft: Coordinate;
        bottomRight: Coordinate;
    };
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} codec - The video codec.
     * @param {number} bitrate - The video bitrate.
     * @param {number} width - The video width.
     * @param {number} height - The video height.
     */
    constructor(codec?: string, bitrate?: number, width?: number, height?: number);
}
