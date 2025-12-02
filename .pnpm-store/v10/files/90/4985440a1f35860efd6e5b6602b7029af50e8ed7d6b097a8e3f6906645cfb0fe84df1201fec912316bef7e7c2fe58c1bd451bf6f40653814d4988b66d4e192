import { Directory, DirectoryResponse, DirectoryState, DirectoryStateResponse, EventDirectory, EventDirectoryResponse } from '../interfaces';
export declare const deserializeDirectory: (directory: DirectoryResponse) => Directory;
export declare const deserializeDirectoryState: (state: DirectoryStateResponse) => DirectoryState;
export declare const deserializeEventDirectory: (directory: EventDirectoryResponse) => EventDirectory;
export declare const deserializeDeletedEventDirectory: (directory: Omit<EventDirectoryResponse, 'domains' | 'external_key'>) => Omit<EventDirectory, 'domains' | 'externalKey'>;
