//#region src/helpers/validators/zod.d.ts
/**
 * Shim for Zod types to ensure hopeful compatibility between minor versions;
 * let developers the latest version of Zod without having to have Inngest match
 * the same version.
 *
 * Feels weird to be using internal properties like this, but types break across
 * minors anyway, so at least with this we rely on fewer fields staying the
 * same.
 */
type ZodLiteral<TValue = any> = {
  get value(): TValue;
  _def: {
    typeName: "ZodLiteral";
  };
};
type ZodTypeAny = {
  _type: any;
  _output: any;
  _input: any;
  _def: any;
};
type ZodObject<TShape = {
  [k: string]: ZodTypeAny;
}> = {
  get shape(): TShape;
  _def: {
    typeName: "ZodObject";
  };
};
type ZodDiscriminatedUnion = {
  _def: {
    typeName: "ZodDiscriminatedUnion";
  };
};
type ZodUnion<TOptions extends (AnyZodObject | ZodDiscriminatedUnion | ZodAny)[] = (AnyZodObject | ZodDiscriminatedUnion | ZodAny)[]> = {
  options: TOptions;
  _def: {
    typeName: "ZodUnion";
  };
};
type AnyZodObject = ZodObject<any>;
type ZodAny = {
  _any: true;
};
type ValidZodValue = AnyZodObject | ZodDiscriminatedUnion | ZodAny | ZodUnion;
type ZodInfer<T extends ZodTypeAny> = T["_output"];
//#endregion
export { AnyZodObject, ValidZodValue, ZodInfer, ZodLiteral, ZodObject, ZodTypeAny };
//# sourceMappingURL=zod.d.cts.map