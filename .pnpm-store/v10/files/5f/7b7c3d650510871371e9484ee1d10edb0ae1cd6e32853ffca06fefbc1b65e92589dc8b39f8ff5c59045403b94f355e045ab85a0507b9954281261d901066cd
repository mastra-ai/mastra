import { MountStat } from './constants';
import type * as stucts from './structs';
export type MountMessage = MountRequest | MountResponse;
export type MountRequest = MountMntRequest | MountUmntRequest | MountDumpRequest | MountUmntallRequest | MountExportRequest;
export type MountResponse = MountMntResponse | MountDumpResponse | MountExportResponse;
export declare class MountMntRequest {
    readonly dirpath: string;
    constructor(dirpath: string);
}
export declare class MountMntResOk {
    readonly fhandle: stucts.MountFhandle3;
    readonly authFlavors: number[];
    constructor(fhandle: stucts.MountFhandle3, authFlavors: number[]);
}
export declare class MountMntResponse {
    readonly status: MountStat;
    readonly mountinfo?: MountMntResOk | undefined;
    constructor(status: MountStat, mountinfo?: MountMntResOk | undefined);
}
export declare class MountDumpRequest {
}
export declare class MountDumpResponse {
    readonly mountlist?: stucts.MountBody | undefined;
    constructor(mountlist?: stucts.MountBody | undefined);
}
export declare class MountUmntRequest {
    readonly dirpath: string;
    constructor(dirpath: string);
}
export declare class MountUmntallRequest {
}
export declare class MountExportRequest {
}
export declare class MountExportResponse {
    readonly exports?: stucts.MountExportNode | undefined;
    constructor(exports?: stucts.MountExportNode | undefined);
}
