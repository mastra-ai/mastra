import { errorConstructors } from './constructors';
export { errorConstructors };
export type SerializedError = {
    name: string;
    message: string;
    stack: string;
    code?: string | number;
    cause?: string;
};
export declare function serializeError(subject: Error): SerializedError;
export declare function deserializeError(subject: SerializedError): Error;
