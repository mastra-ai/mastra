import { InngestMiddleware } from "../components/InngestMiddleware.cjs";

//#region src/middleware/dependencyInjection.d.ts

/**
 * Adds properties to the function input for every function created using this
 * app.
 */
declare const dependencyInjectionMiddleware: <TCtx extends Record<string, any>>(
/**
 * The context to inject into the function input.
 */
ctx: TCtx) => InngestMiddleware<{
  name: string;
  init(): {
    onFunctionRun(): {
      transformInput(): {
        ctx: TCtx;
      };
    };
  };
}>;
//#endregion
export { dependencyInjectionMiddleware };
//# sourceMappingURL=dependencyInjection.d.cts.map