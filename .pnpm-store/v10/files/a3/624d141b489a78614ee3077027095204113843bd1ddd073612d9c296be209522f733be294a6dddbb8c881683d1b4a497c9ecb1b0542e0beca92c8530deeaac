export type Primitive = null | undefined | string | number | boolean | symbol | bigint;
export type Required<T, K extends keyof T = keyof T> = T & {
    [P in K]-?: T[P];
};
export type LiteralUnion<LiteralType extends BaseType, BaseType extends Primitive> = LiteralType | (BaseType & {
    _?: never;
});
