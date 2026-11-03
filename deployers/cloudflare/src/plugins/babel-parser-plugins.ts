import type { InputOptions as BabelOptions } from '@babel/core';
import type { ModuleType } from 'rolldown';

type ParserPlugins = NonNullable<NonNullable<BabelOptions['parserOpts']>['plugins']>;

/** Rolldown hands raw TypeScript/JSX to transform hooks, so Babel has to parse it according to the module type. */
export function getBabelParserPlugins(moduleType: ModuleType): ParserPlugins {
  switch (moduleType) {
    case 'ts':
      return ['typescript'];
    case 'tsx':
      return ['typescript', 'jsx'];
    case 'jsx':
      return ['jsx'];
    default:
      return [];
  }
}
