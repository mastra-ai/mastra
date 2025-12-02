import { CreateFileError } from './errors/CreateFileError.js';
import { LaunchEditorError } from './errors/LaunchEditorError.js';
import { ReadFileError } from './errors/ReadFileError.js';
import { RemoveFileError } from './errors/RemoveFileError.js';
export interface IEditorParams {
    args: string[];
    bin: string;
}
export interface IFileOptions {
    prefix?: string;
    postfix?: string;
    mode?: number;
    template?: string;
    dir?: string;
}
export type StringCallback = (err: Error | undefined, result: string | undefined) => void;
export type VoidCallback = () => void;
export { CreateFileError, LaunchEditorError, ReadFileError, RemoveFileError };
export declare function edit(text?: string, fileOptions?: IFileOptions): string;
export declare function editAsync(text: string | undefined, callback: StringCallback, fileOptions?: IFileOptions): void;
export declare class ExternalEditor {
    text: string;
    tempFile: string;
    editor: IEditorParams;
    lastExitStatus: number;
    private fileOptions;
    get temp_file(): string;
    get last_exit_status(): number;
    constructor(text?: string, fileOptions?: IFileOptions);
    run(): string;
    runAsync(callback: StringCallback): void;
    cleanup(): void;
    private determineEditor;
    private createTemporaryFile;
    private readTemporaryFile;
    private removeTemporaryFile;
    private launchEditor;
    private launchEditorAsync;
}
