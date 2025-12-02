import type { Reader } from '@jsonjoy.com/buffers/lib/Reader';
export declare class MountFhandle3 {
    readonly data: Reader;
    constructor(data: Reader);
}
export declare class MountBody {
    readonly hostname: string;
    readonly directory: string;
    readonly next?: MountBody | undefined;
    constructor(hostname: string, directory: string, next?: MountBody | undefined);
}
export declare class MountGroupNode {
    readonly name: string;
    readonly next?: MountGroupNode | undefined;
    constructor(name: string, next?: MountGroupNode | undefined);
}
export declare class MountExportNode {
    readonly dir: string;
    readonly groups?: MountGroupNode | undefined;
    readonly next?: MountExportNode | undefined;
    constructor(dir: string, groups?: MountGroupNode | undefined, next?: MountExportNode | undefined);
}
