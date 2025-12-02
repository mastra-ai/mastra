//#region src/helpers/env.d.ts

/**
 * @public
 */
type Env = Record<string, EnvValue>;
/**
 * @public
 */
type EnvValue = string | undefined;
interface ModeOptions {
  type: "cloud" | "dev";
  /**
   * Whether the mode was explicitly set, or inferred from other sources.
   */
  isExplicit: boolean;
  /**
   * If the mode was explicitly set as a dev URL, this is the URL that was set.
   */
  explicitDevUrl?: URL;
  /**
   * Environment variables to use when determining the mode.
   */
  env?: Env;
}
declare class Mode {
  readonly type: "cloud" | "dev";
  /**
   * Whether the mode was explicitly set, or inferred from other sources.
   */
  readonly isExplicit: boolean;
  readonly explicitDevUrl?: URL;
  private readonly env;
  constructor({
    type,
    isExplicit,
    explicitDevUrl,
    env
  }: ModeOptions);
  get isDev(): boolean;
  get isCloud(): boolean;
  get isInferred(): boolean;
  /**
   * If we are explicitly in a particular mode, retrieve the URL that we are
   * sure we should be using, not considering any environment variables or other
   * influences.
   */
  getExplicitUrl(defaultCloudUrl: string): string | undefined;
}
//#endregion
export { Env, Mode };
//# sourceMappingURL=env.d.ts.map