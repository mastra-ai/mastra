import { existsSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDynamicWorkspace } from '@mastra/code-sdk/agents/workspace';
import type { WorkspaceSkillExtension } from '@mastra/code-sdk/agents/workspace';
import { LocalSkillSource } from '@mastra/core/workspace';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';

const bundleDirectory = dirname(fileURLToPath(import.meta.url));
const bundledFactorySkillsPath = join(bundleDirectory, 'factory-skills');
const FACTORY_SKILLS_SOURCE_PATH =
  [
    join(process.cwd(), 'src', 'mastra', 'public', 'factory-skills'),
    join(bundleDirectory, '..', '..', 'src', 'mastra', 'public', 'factory-skills'),
    bundledFactorySkillsPath,
  ].find(existsSync) ?? bundledFactorySkillsPath;
const FACTORY_SKILLS_MOUNT = path.resolve(path.parse(process.cwd()).root, '__mastracode_factory_skills__');
const FACTORY_SKILL_NAMES = new Set(['understand-issue', 'understand-pr']);

class FactorySkillSource implements SkillSource {
  readonly #factorySource = new LocalSkillSource({ basePath: FACTORY_SKILLS_SOURCE_PATH });
  readonly #fallbackSkillRoots: Set<string>;

  constructor(
    readonly fallback: SkillSource,
    fallbackSkillRoots: string[],
  ) {
    this.#fallbackSkillRoots = new Set(fallbackSkillRoots.map(skillPath => path.normalize(skillPath)));
  }

  #isFactoryPath(skillPath: string): boolean {
    const normalized = path.normalize(skillPath);
    return normalized === FACTORY_SKILLS_MOUNT || normalized.startsWith(`${FACTORY_SKILLS_MOUNT}${path.sep}`);
  }

  #factoryPath(skillPath: string): string {
    return path.relative(FACTORY_SKILLS_MOUNT, path.normalize(skillPath));
  }

  exists(skillPath: string): Promise<boolean> {
    return this.#isFactoryPath(skillPath)
      ? this.#factorySource.exists(this.#factoryPath(skillPath))
      : this.fallback.exists(skillPath);
  }

  stat(skillPath: string): Promise<SkillSourceStat> {
    return this.#isFactoryPath(skillPath)
      ? this.#factorySource.stat(this.#factoryPath(skillPath))
      : this.fallback.stat(skillPath);
  }

  readFile(skillPath: string): Promise<string | Buffer> {
    return this.#isFactoryPath(skillPath)
      ? this.#factorySource.readFile(this.#factoryPath(skillPath))
      : this.fallback.readFile(skillPath);
  }

  async readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    if (this.#isFactoryPath(skillPath)) {
      return this.#factorySource.readdir(this.#factoryPath(skillPath));
    }
    const entries = await this.fallback.readdir(skillPath);
    if (this.#fallbackSkillRoots.has(path.normalize(skillPath))) {
      return entries.filter(entry => !FACTORY_SKILL_NAMES.has(entry.name));
    }
    return entries;
  }

  realpath(skillPath: string): Promise<string> {
    if (this.#isFactoryPath(skillPath)) return Promise.resolve(path.normalize(skillPath));
    return this.fallback.realpath ? this.fallback.realpath(skillPath) : Promise.resolve(skillPath);
  }
}

const factorySkillExtension: WorkspaceSkillExtension = {
  id: 'web-factory',
  paths: [FACTORY_SKILLS_MOUNT],
  createSource: (fallback, fallbackSkillRoots) => new FactorySkillSource(fallback, fallbackSkillRoots),
};

type DynamicWorkspaceContext = Omit<Parameters<typeof getDynamicWorkspace>[0], 'skillExtension'>;

export function getFactoryWorkspace(context: DynamicWorkspaceContext) {
  return getDynamicWorkspace({ ...context, skillExtension: factorySkillExtension });
}
