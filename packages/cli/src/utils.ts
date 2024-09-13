import fs from 'fs';
import path from 'path';
import { check } from 'tcp-port-used';

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

export function getPrismaBinPath() {
  return path.resolve(
    process.cwd(),
    'node_modules',
    '@kpl/core',
    'node_modules',
    'prisma',
    'node_modules',
    '.bin',
    'prisma',
  );
}

export function getPrismaSchemaPath() {
  return path.resolve(process.cwd(), 'node_modules', '@kpl/core', 'src', 'prisma', 'schema.prisma');
}

export function copyStarterFile(inputFile: string, outputFile: string) {
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '..', 'src', 'starter-files', inputFile);
  const fileString = fs.readFileSync(filePath, 'utf8');

  const outputFilePath = path.join(process.cwd(), outputFile);
  if (fs.existsSync(outputFilePath)) {
    console.log(`${outputFile} already exists`);
    return false;
  }

  fse.outputFileSync(outputFilePath, fileString);
  return fileString;
}

const isPortOpen = async (port: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
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

export async function getInfraPorts() {
  let postgresPort = 5432;
  let inngestPort = 8288;
  const dbPortOpen = await isPortOpen(postgresPort);
  const inngestPortOpen = await isPortOpen(inngestPort);

  if (!dbPortOpen) {
    postgresPort = (await getNextOpenPort(postgresPort)) as number;
  }

  if (!inngestPortOpen) {
    inngestPort = (await getNextOpenPort(inngestPort)) as number;
  }

  return { postgresPort, inngestPort };
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

export const validateNextJsRoot = () => {
  const cwd = process.cwd();

  fs.readdir(cwd, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    const configFiles = files.filter(file => file.startsWith('next.config'));

    if (configFiles.length === 0) {
      throw new Error('@kpl/cli should only be run at the root of your Next.js project');
    }
  });
};
