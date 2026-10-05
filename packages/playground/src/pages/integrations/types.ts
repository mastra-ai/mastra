import type { ListToolProvidersResponse, ListToolProviderToolkitsResponse,ListToolProviderConnectionsResponse } from '@mastra/client-js';

export type ConnectionItem = ListToolProviderConnectionsResponse['items'][number];
export type ProviderItem = ListToolProvidersResponse['providers'][number];
export type ToolkitItem = ListToolProviderToolkitsResponse['data'][number];
export type GroupedConnections = [string, ConnectionItem[]][];
