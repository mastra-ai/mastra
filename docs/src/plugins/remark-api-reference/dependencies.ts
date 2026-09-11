import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { LoadContext, Plugin } from '@docusaurus/types'
import { artifactDirectory, ownedPackages, repositoryRoot, roots } from '../../../scripts/api-reference/config'

export default function apiReferenceDependencies(context: LoadContext): Plugin {
  return {
    name: 'api-reference-dependencies',
    configureWebpack() {
      return {
        module: {
          rules: [
            {
              test: /\.mdx?$/,
              include: join(context.siteDir, 'src/content/en/reference'),
              enforce: 'pre',
              loader: fileURLToPath(new URL('./dependency-loader.cjs', import.meta.url)),
              options: {
                dependencies: roots.map(root => join(artifactDirectory, root.file)),
                sourceDirectories: [...ownedPackages.values()].map(directory => join(repositoryRoot, directory, 'src')),
              },
            },
          ],
        },
      }
    },
  }
}
