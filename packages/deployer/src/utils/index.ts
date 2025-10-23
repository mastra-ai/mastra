import { posix } from 'path';

export function prepareToolsPaths({ mastraDir }: { mastraDir: string }) {
  const normalizedMastraDir = mastraDir.replaceAll('\\', '/');
  const defaultToolsPath = posix.join(normalizedMastraDir, 'tools/**/*.{js,ts}');
  const defaultToolsIgnorePaths = [
    `!${posix.join(normalizedMastraDir, 'tools/**/*.{test,spec}.{js,ts}')}`,
    `!${posix.join(normalizedMastraDir, 'tools/**/__tests__/**')}`,
  ];
  // We pass an array to tinyglobby to allow for the aforementioned negations
  return [defaultToolsPath, ...defaultToolsIgnorePaths];
}
