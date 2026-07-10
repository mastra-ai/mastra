import type { LoadContext, Plugin } from '@docusaurus/types'
import path from 'node:path'

/**
 * Fallback theme registered when `@mastra/docusaurus-plugin-kapa` is not
 * (because its credentials are missing, e.g. in CI). The local
 * `DocRoot/Layout/Main` override imports `@theme/Chat`, which is normally
 * provided by the Kapa theme — this fallback provides a stub so the import
 * always resolves and the build succeeds without the Kapa theme.
 */
export default function pluginKapaFallback(_context: LoadContext): Plugin {
  return {
    name: 'docusaurus-plugin-kapa-fallback',
    getThemePath() {
      return path.resolve(__dirname, './theme')
    },
  }
}
