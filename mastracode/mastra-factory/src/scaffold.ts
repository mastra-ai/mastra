import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAFFOLD_DIRECTORY = fileURLToPath(new URL('../scaffold/', import.meta.url));

/**
 * The scaffold source and its dependency versions are one release unit.
 * Update and verify them together against the packed create-factory artifact.
 */
export function writeFactoryScaffold(projectPath: string, projectName: string): void {
  fs.cpSync(SCAFFOLD_DIRECTORY, projectPath, { recursive: true, errorOnExist: true });
  fs.renameSync(path.join(projectPath, 'gitignore'), path.join(projectPath, '.gitignore'));

  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    name: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  packageJson.name = projectName;

  const dependencyTag = process.env.MASTRA_FACTORY_DEPENDENCY_TAG?.trim();
  if (dependencyTag) {
    for (const dependencies of [packageJson.dependencies, packageJson.devDependencies]) {
      for (const packageName of Object.keys(dependencies)) {
        if (packageName === 'mastra' || packageName.startsWith('@mastra/')) {
          dependencies[packageName] = dependencyTag;
        }
      }
    }
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
