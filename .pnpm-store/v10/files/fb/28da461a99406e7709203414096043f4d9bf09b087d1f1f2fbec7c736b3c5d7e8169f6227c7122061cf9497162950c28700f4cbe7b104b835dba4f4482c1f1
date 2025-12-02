import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '../types';
type ObjectLike = Record<string, unknown>;
export declare class ObjectCoercer implements ErrorTrackingCoercer<ObjectLike> {
    match(candidate: unknown): candidate is ObjectLike;
    coerce(candidate: ObjectLike, ctx: CoercingContext): ExceptionLike | undefined;
    getType(err: Record<string, unknown>): string;
    getValue(err: object): string;
    private isSeverityLevel;
    /** If a plain object has a property that is an `Error`, return this error. */
    private getErrorPropertyFromObject;
    private getObjectClassName;
}
export {};
//# sourceMappingURL=object-coercer.d.ts.map