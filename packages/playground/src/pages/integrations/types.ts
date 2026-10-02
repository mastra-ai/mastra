import type { ListToolProviderConnectionsResponse } from '@mastra/client-js';

import type { useToolProviders, useToolkits } from '@mastra/react/hooks';

export type ConnectionItem = ListToolProviderConnectionsResponse['items'][number];
export type ProviderItem = NonNullable<ReturnType<typeof useToolProviders>['data']>['providers'][number];
export type ToolkitItem = NonNullable<ReturnType<typeof useToolkits>['data']>['data'][number];
export type GroupedConnections = [string, ConnectionItem[]][];
