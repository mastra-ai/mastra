import { WorkOS } from '../workos';
import { AutoPaginatable } from '../common/utils/pagination';
import { DefaultCustomAttributes, Directory, DirectoryGroup, DirectoryUserWithGroups, ListDirectoriesOptions, ListDirectoryGroupsOptions, ListDirectoryUsersOptions } from './interfaces';
export declare class DirectorySync {
    private readonly workos;
    constructor(workos: WorkOS);
    listDirectories(options?: ListDirectoriesOptions): Promise<AutoPaginatable<Directory>>;
    getDirectory(id: string): Promise<Directory>;
    deleteDirectory(id: string): Promise<void>;
    listGroups(options: ListDirectoryGroupsOptions): Promise<AutoPaginatable<DirectoryGroup>>;
    listUsers<TCustomAttributes extends object = DefaultCustomAttributes>(options: ListDirectoryUsersOptions): Promise<AutoPaginatable<DirectoryUserWithGroups<TCustomAttributes>>>;
    getUser<TCustomAttributes extends object = DefaultCustomAttributes>(user: string): Promise<DirectoryUserWithGroups<TCustomAttributes>>;
    getGroup(group: string): Promise<DirectoryGroup>;
}
