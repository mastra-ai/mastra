import { execa } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installMastraSkills } from './skills-install';

vi.mock('execa');

const mockedExeca = vi.mocked(execa);

describe('installMastraSkills', () => {
  beforeEach(() => {
    mockedExeca.mockReset();
  });

  it('installs the official mastra skill for every detected agent', async () => {
    mockedExeca.mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>);

    const result = await installMastraSkills({
      directory: '/tmp/project',
      agents: ['claude-code', 'universal'],
    });

    expect(mockedExeca).toHaveBeenCalledWith(
      'npx',
      ['skills', 'add', 'mastra-ai/skills', '--skill', 'mastra', '--agent', 'claude-code', 'universal', '-y'],
      {
        cwd: '/tmp/project',
        stdio: 'pipe',
      },
    );
    expect(result).toEqual({ success: true, agents: ['claude-code', 'universal'] });
  });

  it('returns installation failures without throwing', async () => {
    mockedExeca.mockRejectedValueOnce(new Error('installation failed'));

    await expect(
      installMastraSkills({
        directory: '/tmp/project',
        agents: ['universal'],
      }),
    ).resolves.toEqual({ success: false, error: 'installation failed', agents: ['universal'] });
  });
});
