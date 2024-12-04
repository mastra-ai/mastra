import fs from 'fs';
import path, { dirname } from 'path';
import { check } from 'tcp-port-used';
import { fileURLToPath } from 'url';

import fse from 'fs-extra/esm';

export function replaceValuesInFile({
  filePath,
  replacements,
}: {
  filePath: string;
  replacements: { search: string; replace: string }[];
}) {
  let fileContent = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(({ search, replace }) => {
    fileContent = fileContent.replaceAll(search, replace);
  });

  fs.writeFileSync(filePath, fileContent);
}

export function getEnginePath() {
  const possibleEnginePaths = [
    path.resolve(process.cwd(), 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), '..', 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), '..', '..', 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), './packages/engine'), // For CI
  ];

  return getFirstExistingFile(possibleEnginePaths);
}

export const getFirstExistingFile = (files: string[]): string => {
  for (const f of files) {
    if (fs.existsSync(f)) {
      return f;
    }
  }

  throw new Error('Missing required file, checked the following paths: ' + files.join(', '));
};

/**
 * Finds and returns the first available directory from an array of paths
 * @param paths - Array of directory paths to check
 * @returns The first valid directory path or null if none found
 */
export function findFirstDirectory(paths: string[]): string | null {
  for (const pathToCheck of paths) {
    try {
      const normalizedPath = path.normalize(pathToCheck);

      if (fs.existsSync(normalizedPath)) {
        const stats = fs.statSync(normalizedPath);

        if (stats.isDirectory()) {
          return normalizedPath;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 *
 * @param inputFile the file in the starter files directory to copy
 * @param outputFilePath the destination path
 * @param replaceIfExists flag to replace if it exists
 * @returns
 */
export async function copyStarterFile(inputFile: string, outputFilePath: string, replaceIfExists?: boolean) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, 'starter-files', inputFile);
  const fileString = fs.readFileSync(filePath, 'utf8');

  if (fs.existsSync(outputFilePath) && !replaceIfExists) {
    console.log(`${outputFilePath} already exists`);
    return false;
  }

  await fse.outputFile(outputFilePath, fileString);

  return true;
}

const isPortOpen = async (port: number): Promise<boolean> => {
  return new Promise(resolve => {
    check(port).then((inUse: boolean) => {
      resolve(!inUse);
    });
  });
};

const getNextOpenPort = async (startFrom: number = 2222): Promise<number> => {
  for (const port of Array.from({ length: 20 }, (_, i) => startFrom + i)) {
    const isOpen = await isPortOpen(port);
    if (isOpen) {
      return port;
    }
  }
  throw new Error('No open ports found after 20 attempts');
};

export async function getInfraPorts({
  defaultAdminPort,
  defaultInngestPort,
  defaultPostgresPort,
}: { defaultAdminPort?: number; defaultInngestPort?: number; defaultPostgresPort?: number } = {}) {
  let postgresPort = defaultPostgresPort || 5432;
  let inngestPort = defaultInngestPort || 8288;
  let adminPort = defaultAdminPort || 3456;
  const dbPortOpen = await isPortOpen(postgresPort);
  const inngestPortOpen = await isPortOpen(inngestPort);
  const adminPortOpen = await isPortOpen(adminPort);

  if (!dbPortOpen) {
    postgresPort = (await getNextOpenPort(postgresPort)) as number;
  }

  if (!inngestPortOpen) {
    inngestPort = (await getNextOpenPort(inngestPort)) as number;
  }

  if (!adminPortOpen) {
    adminPort = (await getNextOpenPort(adminPort)) as number;
  }

  return { postgresPort, inngestPort, adminPort };
}

export function sanitizeForDockerName(name: string): string {
  // Convert to lowercase
  let sanitized = name.toLowerCase();

  // Replace any non-alphanumeric characters (excluding dashes) with dashes
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');

  // Trim dashes from the start and end
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Ensure name is between 2 and 255 characters
  if (sanitized.length < 2) {
    throw new Error('Name must be at least 2 characters long.');
  }
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}

export const toCamelCase = (str: string): string => {
  // If string is already camelCase with no spaces, return as is
  if (/^[a-z][a-zA-Z0-9]*$/.test(str) && !str.includes(' ')) {
    return str;
  }

  return str
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      // If word contains hyphen, return as is
      if (word.includes('-')) {
        return word;
      }

      // If word is already camelCase, preserve its case
      if (/^[a-z][a-zA-Z0-9]*$/.test(word)) {
        return index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Otherwise convert to camelCase
      return index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.toLowerCase().slice(1);
    })
    .join('');
};

export async function getCurrentVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgJsonPath = path.join(__dirname, '..', 'package.json');

  const content = JSON.parse(await fs.promises.readFile(pkgJsonPath, 'utf-8')) as Record<string, any>;
  return content.version;
}

export function findApiKeys() {
  const apiKeyPattern = /_API_KEY$/;

  const apiKeys = Object.entries(process.env)
    .filter(([key, value]) => apiKeyPattern.test(key) && value)
    .map(([key, value]) => ({ name: key, value }));

  return apiKeys;
}
