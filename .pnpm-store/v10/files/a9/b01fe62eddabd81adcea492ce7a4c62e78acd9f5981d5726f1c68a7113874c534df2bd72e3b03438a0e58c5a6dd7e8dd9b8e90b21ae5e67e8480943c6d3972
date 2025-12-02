export declare namespace typeutil {
    type assertEqual<T, Expected> = [T] extends [Expected] ? [Expected] extends [T] ? true : false : false;
    type depromisify<T> = T extends Promise<infer U> ? depromisify<U> : T;
    type identity<T> = T;
    type flatten<T> = {
        [k in keyof T]: T[k];
    } & unknown;
    type tupleOf<T> = [T, ...T[]] | [];
    type writeable<T> = {
        -readonly [P in keyof T]: T[P];
    };
    type nonNeverKeys<T> = {
        [k in keyof T]: [T[k]] extends [never] ? never : k;
    }[keyof T];
    type stripNever<T> = {
        [k in nonNeverKeys<T>]: k extends keyof T ? T[k] : never;
    };
    type optionalKeys<T extends object> = {
        [k in keyof T]: undefined extends T[k] ? k : never;
    }[keyof T];
    type requiredKeys<T extends object> = Exclude<keyof T, optionalKeys<T>>;
    type addQuestionMarks<T extends object> = {
        [k in optionalKeys<T>]?: T[k];
    } & {
        [k in requiredKeys<T>]: T[k];
    };
}
