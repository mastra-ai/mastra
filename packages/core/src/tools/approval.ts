type RequestContextLike = Record<string, unknown> | { entries(): Iterable<[string, unknown]> };

function toPlainRequestContext(requestContext?: RequestContextLike): Record<string, unknown> {
  if (!requestContext) return {};
  if (typeof (requestContext as { entries?: unknown }).entries === 'function') {
    return Object.fromEntries((requestContext as { entries(): Iterable<[string, unknown]> }).entries());
  }
  return requestContext as Record<string, unknown>;
}

export async function resolveToolRequiresApproval({
  tool,
  args,
  requireToolApproval,
  requestContext,
  workspace,
  logger,
  toolName,
}: {
  tool: unknown;
  args?: Record<string, unknown>;
  requireToolApproval?: boolean;
  requestContext?: RequestContextLike;
  workspace?: object;
  logger?: { error: (...args: any[]) => void };
  toolName?: string;
}): Promise<boolean> {
  if (!tool) {
    return Boolean(requireToolApproval);
  }

  const toolRequireApproval = (tool as any).requireApproval;
  const aiSdkNeedsApproval = (tool as any).needsApproval;
  const staticRequiresApproval = Boolean(
    requireToolApproval ||
    (typeof toolRequireApproval === 'boolean' && toolRequireApproval) ||
    (typeof aiSdkNeedsApproval === 'boolean' && aiSdkNeedsApproval),
  );
  const needsApprovalFn =
    typeof (tool as any).needsApprovalFn === 'function'
      ? (tool as any).needsApprovalFn
      : typeof toolRequireApproval === 'function'
        ? toolRequireApproval
        : typeof aiSdkNeedsApproval === 'function'
          ? aiSdkNeedsApproval
          : undefined;

  if (!needsApprovalFn) {
    return staticRequiresApproval;
  }

  try {
    const needsApprovalResult = await needsApprovalFn(args ?? {}, {
      requestContext: toPlainRequestContext(requestContext),
      workspace,
    });
    return staticRequiresApproval || Boolean(needsApprovalResult);
  } catch (error) {
    logger?.error(`Error evaluating needsApprovalFn for tool ${toolName ?? 'unknown'}:`, error);
    return true;
  }
}
