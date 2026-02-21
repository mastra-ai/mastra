import type { SlashCommandContext } from './types.js';

export async function handlePermissionsCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  if (args[0] === 'set' && args.length >= 3) {
    const category = args[1] as any;
    const policy = args[2] as any;
    const validCategories = ['read', 'edit', 'execute', 'mcp'];
    const validPolicies = ['allow', 'ask', 'deny'];
    if (!validCategories.includes(category)) {
      ctx.showInfo(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
      return;
    }
    if (!validPolicies.includes(policy)) {
      ctx.showInfo(`Invalid policy: ${policy}. Must be one of: ${validPolicies.join(', ')}`);
      return;
    }
    ctx.harness.setPermissionForCategory({ category, policy });
    ctx.showInfo(`Set ${category} policy to: ${policy}`);
    return;
  }
  await showPermissions(ctx);
}

async function showPermissions(ctx: SlashCommandContext): Promise<void> {
  const { TOOL_CATEGORIES, getToolsForCategory } = await import('../../permissions.js');
  const rules = ctx.harness.getPermissionRules();
  const grants = ctx.harness.getSessionGrants();
  const isYolo = (ctx.harness.getState() as any).yolo === true;

  const lines: string[] = [];
  lines.push('Tool Approval Permissions');
  lines.push('─'.repeat(40));

  if (isYolo) {
    lines.push('');
    lines.push('⚡ YOLO mode is ON — all tools are auto-approved');
    lines.push('  Use /yolo to toggle off');
  }

  lines.push('');
  lines.push('Category Policies:');
  for (const [cat, meta] of Object.entries(TOOL_CATEGORIES)) {
    const policy = rules.categories[cat as keyof typeof rules.categories] || 'ask';
    const sessionGranted = grants.categories.includes(cat as any);
    const tools = getToolsForCategory(cat as any);
    const status = sessionGranted ? `${policy} (session: always allow)` : policy;
    lines.push(`  ${meta.label.padEnd(12)} ${status.padEnd(16)} tools: ${tools.join(', ')}`);
  }

  if (Object.keys(rules.tools).length > 0) {
    lines.push('');
    lines.push('Per-tool Overrides:');
    for (const [tool, policy] of Object.entries(rules.tools)) {
      lines.push(`  ${tool.padEnd(24)} ${policy}`);
    }
  }

  if (grants.categories.length > 0 || grants.tools.length > 0) {
    lines.push('');
    lines.push('Session Grants (reset on restart):');
    if (grants.categories.length > 0) {
      lines.push(`  Categories: ${grants.categories.join(', ')}`);
    }
    if (grants.tools.length > 0) {
      lines.push(`  Tools: ${grants.tools.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('Commands:');
  lines.push('  /permissions set <category> <allow|ask|deny>');
  lines.push('  /yolo — toggle auto-approve all tools');

  ctx.showInfo(lines.join('\n'));
}
