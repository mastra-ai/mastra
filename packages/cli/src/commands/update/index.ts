import { readFileSync } from 'fs';
import { join } from 'path';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { DepsService } from '../../services/service.deps';
import { logger } from '../../utils/logger';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface MastraPackage {
  name: string;
  version: string;
  isAlpha: boolean;
}

function readPackageJson(dir: string): PackageJson {
  const packageJsonPath = join(dir, 'package.json');
  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to read package.json: ${error.message}`);
    }
    throw error;
  }
}

function getMastraPackages(packageJson: PackageJson): MastraPackage[] {
  const allDependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };

  const mastraPackages = Object.entries(allDependencies).filter(
    ([name]) => name.startsWith('@mastra/') || name === 'mastra',
  );

  return mastraPackages.map(([name, version]) => ({
    name,
    version,
    isAlpha: version.includes('alpha'),
  }));
}

export async function update({ alpha, latest, root }: { alpha?: boolean; latest?: boolean; root?: string }) {
  const rootDir = root || process.cwd();
  const s = p.spinner();

  try {
    s.start('Reading package.json');
    const packageJson = readPackageJson(rootDir);
    const mastraPackages = getMastraPackages(packageJson);
    s.stop('Package.json read successfully');

    if (mastraPackages.length === 0) {
      p.note('No Mastra packages found in your project');
      return;
    }

    const hasAlpha = mastraPackages.some(pkg => pkg.isAlpha);
    const hasLatest = mastraPackages.some(pkg => !pkg.isAlpha);

    let targetVersion = latest ? 'latest' : alpha ? 'alpha' : undefined;

    if (!targetVersion && hasAlpha && hasLatest) {
      const versionChoice = await p.select({
        message: 'Found both alpha and latest versions. Which version would you like to install?',
        options: [
          { value: 'latest', label: 'Latest', hint: 'stable version' },
          { value: 'alpha', label: 'Alpha', hint: 'pre-release version' },
        ],
      });

      if (p.isCancel(versionChoice)) {
        p.cancel('Operation cancelled');
        return;
      }

      targetVersion = versionChoice;
    } else if (!targetVersion) {
      targetVersion = hasAlpha ? 'alpha' : 'latest';
    }

    s.start('Updating Mastra packages');
    const depsService = new DepsService();
    const packagesToUpdate = mastraPackages.map(pkg => `${pkg.name}@${targetVersion}`);

    await depsService.installPackages(packagesToUpdate);
    s.stop('Mastra packages updated successfully');

    p.note(`
      ${color.green('Mastra packages updated successfully!')}
      
      Updated packages:
      ${mastraPackages.map(pkg => `- ${pkg.name} to ${targetVersion}`).join('\n')}
    `);
  } catch (error) {
    s.stop('Failed to update packages');
    if (error instanceof Error) {
      logger.error(`Error updating packages: ${error.message}`);
    }
    throw error;
  }
}
