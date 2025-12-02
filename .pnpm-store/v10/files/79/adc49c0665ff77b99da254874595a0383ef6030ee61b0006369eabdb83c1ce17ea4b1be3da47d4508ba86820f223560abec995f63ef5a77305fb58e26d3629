import { Nlm4Stat } from './constants';
import type { Reader } from '@jsonjoy.com/buffers/lib/Reader';
import type * as stucts from './structs';
export type NlmMessage = NlmRequest | NlmResponse;
export type NlmRequest = Nlm4TestRequest | Nlm4LockRequest | Nlm4CancelRequest | Nlm4UnlockRequest | Nlm4GrantedRequest | Nlm4ShareRequest | Nlm4UnshareRequest | Nlm4NmLockRequest | Nlm4FreeAllRequest;
export type NlmResponse = Nlm4TestResponse | Nlm4Response | Nlm4ShareResponse;
export declare class Nlm4TestArgs {
    readonly cookie: Reader;
    readonly exclusive: boolean;
    readonly lock: stucts.Nlm4Lock;
    constructor(cookie: Reader, exclusive: boolean, lock: stucts.Nlm4Lock);
}
export declare class Nlm4TestRequest {
    readonly args: Nlm4TestArgs;
    constructor(args: Nlm4TestArgs);
}
export declare class Nlm4TestDenied {
    readonly holder: stucts.Nlm4Holder;
    constructor(holder: stucts.Nlm4Holder);
}
export declare class Nlm4TestResponse {
    readonly cookie: Reader;
    readonly stat: Nlm4Stat;
    readonly holder?: stucts.Nlm4Holder | undefined;
    constructor(cookie: Reader, stat: Nlm4Stat, holder?: stucts.Nlm4Holder | undefined);
}
export declare class Nlm4LockArgs {
    readonly cookie: Reader;
    readonly block: boolean;
    readonly exclusive: boolean;
    readonly lock: stucts.Nlm4Lock;
    readonly reclaim: boolean;
    readonly state: number;
    constructor(cookie: Reader, block: boolean, exclusive: boolean, lock: stucts.Nlm4Lock, reclaim: boolean, state: number);
}
export declare class Nlm4LockRequest {
    readonly args: Nlm4LockArgs;
    constructor(args: Nlm4LockArgs);
}
export declare class Nlm4Response {
    readonly cookie: Reader;
    readonly stat: Nlm4Stat;
    constructor(cookie: Reader, stat: Nlm4Stat);
}
export declare class Nlm4CancelArgs {
    readonly cookie: Reader;
    readonly block: boolean;
    readonly exclusive: boolean;
    readonly lock: stucts.Nlm4Lock;
    constructor(cookie: Reader, block: boolean, exclusive: boolean, lock: stucts.Nlm4Lock);
}
export declare class Nlm4CancelRequest {
    readonly args: Nlm4CancelArgs;
    constructor(args: Nlm4CancelArgs);
}
export declare class Nlm4UnlockArgs {
    readonly cookie: Reader;
    readonly lock: stucts.Nlm4Lock;
    constructor(cookie: Reader, lock: stucts.Nlm4Lock);
}
export declare class Nlm4UnlockRequest {
    readonly args: Nlm4UnlockArgs;
    constructor(args: Nlm4UnlockArgs);
}
export declare class Nlm4GrantedRequest {
    readonly args: Nlm4TestArgs;
    constructor(args: Nlm4TestArgs);
}
export declare class Nlm4ShareArgs {
    readonly cookie: Reader;
    readonly share: stucts.Nlm4Share;
    readonly reclaim: boolean;
    constructor(cookie: Reader, share: stucts.Nlm4Share, reclaim: boolean);
}
export declare class Nlm4ShareRequest {
    readonly args: Nlm4ShareArgs;
    constructor(args: Nlm4ShareArgs);
}
export declare class Nlm4ShareResponse {
    readonly cookie: Reader;
    readonly stat: Nlm4Stat;
    readonly sequence: number;
    constructor(cookie: Reader, stat: Nlm4Stat, sequence: number);
}
export declare class Nlm4UnshareRequest {
    readonly args: Nlm4ShareArgs;
    constructor(args: Nlm4ShareArgs);
}
export declare class Nlm4NmLockRequest {
    readonly args: Nlm4LockArgs;
    constructor(args: Nlm4LockArgs);
}
export declare class Nlm4FreeAllRequest {
    readonly notify: stucts.Nlm4Notify;
    constructor(notify: stucts.Nlm4Notify);
}
