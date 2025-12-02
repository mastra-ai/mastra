import { type Extension } from '@codemirror/state';
import { type BasicSetupOptions } from '@uiw/codemirror-extensions-basic-setup';
export * from '@codemirror/theme-one-dark';
export * from './theme/light';
export interface DefaultExtensionsOptions {
    indentWithTab?: boolean;
    basicSetup?: boolean | BasicSetupOptions;
    placeholder?: string | HTMLElement;
    theme?: 'light' | 'dark' | 'none' | Extension;
    readOnly?: boolean;
    editable?: boolean;
}
export declare const getDefaultExtensions: (optios?: DefaultExtensionsOptions) => Extension[];
