export {
  BARE_SPECIFIER_FILTER,
  EXTERNAL_PROTOCOL_RE,
  NON_USER_CODE_IDS,
  escapeRegExp,
  exactIdsRegex,
  exactPathRegex,
  packageSubpathsRegex,
  packagesRegex,
} from './filters';
export { extractImportedBindings } from './imported-bindings';
export { TREESHAKE_SMALLEST, bundlerLogLevel, cjsGlobalsDefine, getPlatformOptions } from './options';
export { bareExternals, lodashImports, scopedDefine } from './plugins';
export type { BareExternalsOptions } from './plugins';
export { VIRTUAL_PREFIX, virtualModules } from './virtual';
