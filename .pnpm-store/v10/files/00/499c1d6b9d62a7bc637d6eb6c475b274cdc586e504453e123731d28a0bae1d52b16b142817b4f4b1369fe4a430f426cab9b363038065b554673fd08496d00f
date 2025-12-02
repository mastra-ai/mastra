export type Param = {
    shorthand?: string;
    description?: string;
    required?: boolean | string | undefined;
} & ({
    value?: "boolean";
} | {
    value: "number";
} | {
    value: "string";
} | {
    value: {
        [key: number]: string;
    };
});
export type Params = {
    [name: string]: Param;
};
type InferReturnType<T extends Params> = {
    [name in keyof T]: (T[name]["value"] extends "number" ? number : T[name]["value"] extends "string" ? string : T[name]["value"] extends {
        [key: number]: string;
    } ? T[name]["value"][number] : T[name]["value"] extends never ? boolean : boolean) | (T[name]["required"] extends string | true ? never : undefined);
};
export declare function parseArgs<T extends Params>(params: T, args: string[], help?: boolean | string): InferReturnType<T>;
export declare function parseOrReadJSON(jsonOrPath: string): unknown;
export declare function readPipe(): Promise<string>;
export declare function printParams(params: Record<string, Param>): void;
export {};
