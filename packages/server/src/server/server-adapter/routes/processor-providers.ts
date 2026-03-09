import { LIST_PROCESSOR_PROVIDERS_ROUTE, GET_PROCESSOR_PROVIDER_ROUTE } from '../../handlers/processor-providers';
import type { ServerRoute } from '.';

export const PROCESSOR_PROVIDER_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_PROCESSOR_PROVIDERS_ROUTE,
  GET_PROCESSOR_PROVIDER_ROUTE,
];
