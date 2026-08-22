import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export function intelligenceIndexLoader({ request }: Pick<LoaderFunctionArgs, 'request'>) {
  const url = new URL(request.url);
  const legacyEntityId = url.searchParams.get('agent');
  if (!legacyEntityId) return null;

  url.searchParams.delete('agent');
  const search = url.searchParams.toString();
  return redirect(`/intelligence/entities/agent/${encodeURIComponent(legacyEntityId)}${search ? `?${search}` : ''}`);
}
