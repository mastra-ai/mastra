export declare class FetchError<T> extends Error {
    readonly name: string;
    readonly message: string;
    readonly response: {
        status: number;
        headers: Headers;
        data: T;
    };
    constructor({ message, response, }: {
        message: string;
        readonly response: FetchError<T>['response'];
    });
}
