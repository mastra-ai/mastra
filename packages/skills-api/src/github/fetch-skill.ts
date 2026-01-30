/**
 * Fetch skill content from GitHub
 */

import matter from 'gray-matter';

export interface SkillContent {
  /** Raw SKILL.md content */
  raw: string;
  /** Parsed frontmatter metadata */
  metadata: {
    name: string;
    description: string;
    license?: string;
    version?: string;
    author?: string;
    [key: string]: unknown;
  };
  /** Markdown instructions (body without frontmatter) */
  instructions: string;
}

export interface FetchSkillResult {
  success: boolean;
  content?: SkillContent;
  error?: string;
  /** The path where the SKILL.md was found */
  path?: string;
}

/**
 * Common paths where skills might be located in a repo
 */
const SKILL_PATH_PATTERNS = [
  'skills/{skillId}/SKILL.md',
  '{skillId}/SKILL.md',
  '.skills/{skillId}/SKILL.md',
  'agent-skills/{skillId}/SKILL.md',
];

/**
 * Fetch a skill's SKILL.md content from GitHub
 */
export async function fetchSkillFromGitHub(
  owner: string,
  repo: string,
  skillId: string,
  branch = 'main',
): Promise<FetchSkillResult> {
  // Try each path pattern
  for (const pattern of SKILL_PATH_PATTERNS) {
    const path = pattern.replace('{skillId}', skillId);
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

    try {
      const response = await fetch(url);

      if (response.ok) {
        const raw = await response.text();

        // Parse frontmatter
        const parsed = matter(raw);
        const metadata = parsed.data as SkillContent['metadata'];
        const instructions = parsed.content.trim();

        return {
          success: true,
          content: {
            raw,
            metadata,
            instructions,
          },
          path,
        };
      }
    } catch {
      // Try next pattern
      continue;
    }
  }

  // If skill name differs from skillId (e.g., vercel-react-best-practices vs react-best-practices)
  // Try without prefix
  const simplifiedSkillId = skillId.replace(/^[a-z]+-/, '');
  if (simplifiedSkillId !== skillId) {
    for (const pattern of SKILL_PATH_PATTERNS) {
      const path = pattern.replace('{skillId}', simplifiedSkillId);
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

      try {
        const response = await fetch(url);

        if (response.ok) {
          const raw = await response.text();
          const parsed = matter(raw);
          const metadata = parsed.data as SkillContent['metadata'];
          const instructions = parsed.content.trim();

          return {
            success: true,
            content: {
              raw,
              metadata,
              instructions,
            },
            path,
          };
        }
      } catch {
        continue;
      }
    }
  }

  return {
    success: false,
    error: `Could not find SKILL.md for ${skillId} in ${owner}/${repo}`,
  };
}

/**
 * List all skills in a GitHub repository
 */
export async function listSkillsInRepo(
  owner: string,
  repo: string,
  branch = 'main',
): Promise<{ skills: string[]; path: string } | null> {
  const SKILLS_DIRS = ['skills', '.skills', 'agent-skills', ''];

  for (const dir of SKILLS_DIRS) {
    const path = dir ? `${dir}` : '';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'skills-api',
        },
      });

      if (!response.ok) continue;

      const items = (await response.json()) as Array<{ name: string; type: string }>;
      const directories = items.filter(item => item.type === 'dir').map(item => item.name);

      // Check if any directory contains a SKILL.md
      const skillDirs: string[] = [];
      for (const dirName of directories.slice(0, 20)) {
        // Limit to first 20 to avoid rate limiting
        const skillUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path ? path + '/' : ''}${dirName}/SKILL.md`;
        try {
          const skillResponse = await fetch(skillUrl, { method: 'HEAD' });
          if (skillResponse.ok) {
            skillDirs.push(dirName);
          }
        } catch {
          continue;
        }
      }

      if (skillDirs.length > 0) {
        return { skills: skillDirs, path };
      }
    } catch {
      continue;
    }
  }

  return null;
}
