import type { FsPromisesApi } from 'memfs/lib/node/types';
import * as msg from '../messages';
export interface Nfsv4Client {
    compound(request: msg.Nfsv4CompoundRequest): Promise<msg.Nfsv4CompoundResponse>;
    compound(operations: msg.Nfsv4Request[], tag?: string, minorversion?: number): Promise<msg.Nfsv4CompoundResponse>;
    null(): Promise<void>;
}
export interface NfsFsClient extends Pick<FsPromisesApi, 'readFile' | 'writeFile' | 'readdir' | 'mkdir' | 'access' | 'appendFile' | 'copyFile' | 'link' | 'realpath' | 'rename' | 'rmdir' | 'truncate' | 'unlink' | 'utimes' | 'symlink' | 'stat' | 'readlink' | 'opendir' | 'open' | 'chmod' | 'rm' | 'chown' | 'lchmod' | 'lchown' | 'lutimes' | 'lstat' | 'mkdtemp' | 'statfs' | 'watch' | 'glob'> {
}
