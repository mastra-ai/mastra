export declare class ConnSpec {
    scheme: string;
    hosts: [string, number][];
    bucket: string;
    options: {
        [key: string]: string | string[];
    };
    constructor(data?: Partial<ConnSpec>);
    static parse(connStr: string): ConnSpec;
    toString(): string;
}
