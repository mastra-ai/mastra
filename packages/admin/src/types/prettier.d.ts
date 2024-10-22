declare module 'prettier/standalone' {
  import { Options } from 'prettier';

  export function format(source: string, option?: Options): Promise<string>;
  export function check(souce: string, option?: Options): boolean;
  export const version: string;
}

declare module 'prettier/parser-typescript' {
  import { Plugin } from 'prettier';
  const plugin: Plugin;
  export default plugin;
}
