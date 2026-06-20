import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveAppIconPath, resolveStarterOutputPath, resolveStudioDistPath } from './paths';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe('desktop resource paths', () => {
  const previousStudioDist = process.env.MASTRA_DESKTOP_STUDIO_DIST;
  const previousStarterOutput = process.env.MASTRA_DESKTOP_STARTER_OUTPUT;
  const previousIcon = process.env.MASTRA_DESKTOP_ICON;

  afterEach(() => {
    restoreEnv('MASTRA_DESKTOP_STUDIO_DIST', previousStudioDist);
    restoreEnv('MASTRA_DESKTOP_STARTER_OUTPUT', previousStarterOutput);
    restoreEnv('MASTRA_DESKTOP_ICON', previousIcon);
  });

  it('resolves packaged Studio and starter resources from Electron resources', () => {
    expect(resolveStudioDistPath({ packaged: true, resourcesPath: '/Applications/Mastra Studio.app/Contents/Resources' })).toBe(
      '/Applications/Mastra Studio.app/Contents/Resources/studio',
    );
    expect(
      resolveStarterOutputPath({ packaged: true, resourcesPath: '/Applications/Mastra Studio.app/Contents/Resources' }),
    ).toBe('/Applications/Mastra Studio.app/Contents/Resources/starter-output');
    expect(resolveAppIconPath({ packaged: true, resourcesPath: '/Applications/Mastra Studio.app/Contents/Resources' })).toBe(
      '/Applications/Mastra Studio.app/Contents/Resources/icon.png',
    );
  });

  it('allows local resource path overrides for development smoke checks', () => {
    process.env.MASTRA_DESKTOP_STUDIO_DIST = '../playground/dist';
    process.env.MASTRA_DESKTOP_STARTER_OUTPUT = './.mastra/output';
    process.env.MASTRA_DESKTOP_ICON = './build/icon.png';

    expect(resolveStudioDistPath({ packaged: false, resourcesPath: '/unused' })).toBe(resolve('../playground/dist'));
    expect(resolveStarterOutputPath({ packaged: false, resourcesPath: '/unused' })).toBe(resolve('./.mastra/output'));
    expect(resolveAppIconPath({ packaged: false, resourcesPath: '/unused' })).toBe(resolve('./build/icon.png'));
  });

  it('resolves the development starter output relative to the compiled main directory', () => {
    delete process.env.MASTRA_DESKTOP_STARTER_OUTPUT;

    expect(resolveStarterOutputPath({ packaged: false, resourcesPath: '/unused' })).toContain(
      join('packages', 'studio-desktop', '.mastra', 'output'),
    );
  });
});
