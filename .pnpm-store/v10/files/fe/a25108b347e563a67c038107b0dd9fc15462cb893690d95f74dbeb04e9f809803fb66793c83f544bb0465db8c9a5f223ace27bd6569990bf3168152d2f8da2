import { ComponentDoc, ParserOptions } from '../parser';
export interface ExpectedComponents {
    [key: string]: ExpectedComponent;
}
export interface ExpectedComponent {
    [key: string]: ExpectedProp;
}
export interface ExpectedProp {
    type: string;
    required?: boolean;
    description?: string;
    defaultValue?: string | number | boolean | null | undefined;
    parent?: {
        name: string;
        fileName: string;
    };
    raw?: string;
    value?: any;
    tags?: {
        [key: string]: string;
    };
}
export declare function fixturePath(componentName: string): string;
export declare function check(componentName: string, expected: ExpectedComponents, exactProperties?: boolean, description?: string | null, parserOpts?: ParserOptions): void;
export declare function checkComponent(actual: ComponentDoc[], expected: ExpectedComponents, exactProperties?: boolean, description?: string | null): void;
