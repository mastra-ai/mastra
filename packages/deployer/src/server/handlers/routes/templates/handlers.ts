import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  installTemplateHandler as getOriginalInstallTemplateHandler,
  type TemplateInstallationRequest,
} from '@mastra/server/handlers/templates';
import type { Context } from 'hono';

import { handleError } from '../../error';

export async function installTemplateHandler(c: Context): Promise<Response> {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = (await c.req.json()) as TemplateInstallationRequest;

    const result = await getOriginalInstallTemplateHandler({
      mastra,
      runtimeContext,
      repo: body.repo,
      ref: body.ref,
      slug: body.slug,
      targetPath: body.targetPath,
      variables: body.variables,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error installing template');
  }
}
