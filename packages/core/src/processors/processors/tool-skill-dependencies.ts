import type { ToolPolicy, ToolPolicyArgs } from '../../tools/tool-policy';
import { getSkillReadiness } from './skill-readiness';

export type ToolSkillDependencies = Readonly<
  Record<string, readonly string[] | ((args: ToolPolicyArgs) => readonly string[])>
>;

/** Uses SkillSearchProcessor's authoritative request snapshot; never loads skills itself. */
export function createToolSkillPolicy(dependencies: ToolSkillDependencies): ToolPolicy {
  const rules: ToolSkillDependencies = Object.fromEntries(
    Object.entries(dependencies).map(([toolName, rule]) => {
      if (['search_tools', 'load_tool', 'search_skills', 'load_skill'].includes(toolName)) {
        throw new Error(`Skill dependency rules cannot protect the recovery tool "${toolName}".`);
      }
      return [toolName, typeof rule === 'function' ? rule : Object.freeze([...rule])];
    }),
  );
  return args => {
    const rule = Object.hasOwn(rules, args.toolName) ? rules[args.toolName] : undefined;
    if (args.hasExecute === false && (typeof rule === 'function' || rule?.length))
      return {
        allowed: false,
        error: { code: 'TOOL_DEPENDENCY_UNENFORCEABLE', tool: args.toolName, retryable: false },
      };
    const required = typeof rule === 'function' ? rule(args) : rule;
    if (!required?.length) return { allowed: true };
    const snapshot = getSkillReadiness(args.requestContext);
    const missingSkills = [...new Set(required)].filter(name => !snapshot?.readySkills.includes(name));
    if (!missingSkills.length) return { allowed: true };
    const unavailableSkills = snapshot ? missingSkills.filter(name => !snapshot.availableSkills.includes(name)) : [];
    return {
      allowed: false,
      error: {
        code: unavailableSkills.length ? 'REQUIRED_SKILL_UNAVAILABLE' : 'MISSING_REQUIRED_SKILL',
        tool: args.toolName,
        missingSkills,
        ...(unavailableSkills.length ? { unavailableSkills } : {}),
        retryable: unavailableSkills.length === 0,
      },
    };
  };
}
