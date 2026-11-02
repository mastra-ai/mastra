import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { z } from 'zod';

export function setupFixture() {
  const workspaceId = randomUUID(),
    companyId = randomUUID(),
    listId = randomUUID();
  const list = {
    id: { workspace_id: workspaceId, list_id: listId },
    name: 'Lead Qualification Demo',
    api_slug: 'lead_qualification_demo',
    parent_object: [companyId],
  };
  const lists = [list];
  const attributes: Array<{
    id: { workspace_id: string; list_id: string; attribute_id: string };
    title: string;
    api_slug: string;
    type: string;
    is_archived: boolean;
    is_multiselect: boolean;
    is_required: boolean;
    is_unique: boolean;
  }> = [];
  const choices = new Map<
    string,
    Array<{
      id: { workspace_id: string; attribute_id: string; option_id?: string; status_id?: string };
      title: string;
      is_archived: boolean;
    }>
  >();
  let failedAfter: number | undefined;
  let mutations = 0;
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    const parsed = new URL(url instanceof Request ? url.url : url.toString());
    if (parsed.origin !== 'https://api.attio.com') throw new Error('Unexpected setup destination');
    const path = parsed.pathname.split('/').filter(Boolean).slice(1);
    const method = init?.method ?? 'GET';
    const data = init?.body ? (JSON.parse(z.string().parse(init.body)).data as Record<string, unknown>) : undefined;
    if (method !== 'GET') {
      if (failedAfter !== undefined && mutations >= failedAfter) {
        failedAfter = undefined;
        return Response.json({ message: 'private raw response' }, { status: 503 });
      }
      mutations++;
    }
    if (path[0] === 'self') return Response.json({ active: true, workspace_id: workspaceId });
    if (path[0] === 'objects')
      return Response.json({
        data: [{ id: { workspace_id: workspaceId, object_id: companyId }, api_slug: 'companies' }],
      });
    if (path.length === 1 && path[0] === 'lists') {
      if (method === 'POST') {
        const created = {
          id: { workspace_id: workspaceId, list_id: randomUUID() },
          name: String(data!.name),
          api_slug: String(data!.api_slug),
          parent_object: [companyId],
        };
        lists.push(created);
        return Response.json({ data: created });
      }
      return Response.json({ data: lists });
    }
    if (path[0] === 'lists' && path[2] === 'attributes') {
      if (path.length === 3) {
        if (method === 'POST') {
          if (typeof data!.description !== 'string')
            return Response.json({ message: 'Description required' }, { status: 400 });
          const attribute = {
            id: { workspace_id: workspaceId, list_id: path[1]!, attribute_id: randomUUID() },
            title: String(data!.title),
            api_slug: String(data!.api_slug),
            type: String(data!.type),
            is_archived: false,
            is_multiselect: false,
            is_required: false,
            is_unique: false,
          };
          attributes.push(attribute);
          return Response.json({ data: attribute });
        }
        return Response.json({ data: attributes.filter(attribute => attribute.id.list_id === path[1]) });
      }
      const attributeId = path[3]!;
      const entries = choices.get(attributeId) ?? [];
      if (method === 'POST') {
        const option = {
          id: {
            workspace_id: workspaceId,
            attribute_id: attributeId,
            ...(path[4] === 'statuses' ? { status_id: randomUUID() } : { option_id: randomUUID() }),
          },
          title: String(data!.title),
          is_archived: false,
        };
        entries.push(option);
        choices.set(attributeId, entries);
        return Response.json({ data: option });
      }
      return Response.json({ data: entries });
    }
    throw new Error('Unexpected setup request');
  });
  return {
    workspaceId,
    companyId,
    listId,
    list,
    lists,
    attributes,
    choices,
    transport,
    mutationCount: () => mutations,
    failAfter: (count: number) => {
      failedAfter = count;
    },
  };
}
