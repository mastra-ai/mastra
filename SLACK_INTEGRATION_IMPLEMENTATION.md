# Slack Integration - Implementation Guide

## Overview

Add an "Integrations" tab to the agent detail page in playground-ui that supports extensible integration components. By default, it shows a Slack integration teaser in local playground, and accepts custom integration components in cloud environments.

---

## Architecture

### Composable Integration Pattern

The `AgentInformation` component accepts an optional `integrations` prop that can contain any React components. This allows:

- **Local Playground**: Shows default teaser components (e.g., SlackTab)
- **Cloud**: Passes fully-featured integration components with data fetching and state management

---

## Implementation

### 1. **AgentInformation Component**

**Location**: `/packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx`

**Changes**:

- Added `integrations?: ReactNode` prop
- Added "Integrations" tab to the tab list
- Tab content shows `integrations` if provided, otherwise falls back to default `SlackTab` teaser

```tsx
export interface AgentInformationProps {
  agentId: string;
  threadId: string;
  integrations?: ReactNode;
}

// In tab content:
<TabContent value="integrations">{integrations || (agent && <SlackTab agentName={agent.name} />)}</TabContent>;
```

---

### 2. **SlackTab Component (Default Teaser)**

**Location**: `/packages/playground-ui/src/domains/agents/integrations/slack-tab.tsx`

**Purpose**: Simple teaser component for local playground

**Features**:

- Displays Slack logo and integration description
- Shows callout: "Available in Mastra Cloud"
- Links to https://cloud.mastra.ai/ for sign up
- No data fetching or state management
- No functional buttons

**When Shown**:

- Local playground when no `integrations` prop is passed
- Acts as a reference implementation for cloud

---

### 3. **SlackIcon**

**Location**: `/packages/playground-ui/src/ds/icons/SlackIcon.tsx`

**Purpose**: Official Slack logo with brand colors for use in integration UI

---

## Cloud Implementation

### How to Use in Mastra Cloud

In your cloud repository, create a full-featured Slack integration component and pass it to `AgentInformation`:

```tsx
// In your cloud repo
import { AgentInformation } from '@mastra/playground-ui';
import { SlackIntegration } from '@/components/integrations/SlackIntegration';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';

function CloudAgentPage() {
  const { agentId, threadId } = useParams();

  // Fetch Slack integration data in cloud
  const slackIntegration = useSlackIntegration(agentId);

  return (
    <AgentInformation
      agentId={agentId}
      threadId={threadId}
      integrations={<SlackIntegration agentId={agentId} integration={slackIntegration} />}
    />
  );
}
```

---

### Example Cloud SlackIntegration Component

```tsx
// In cloud repo: /components/integrations/SlackIntegration.tsx

interface SlackIntegrationProps {
  agentId: string;
  integration: {
    teamName: string;
    teamId: string;
    botUserId: string;
    connected: boolean;
  } | null;
}

export function SlackIntegration({ agentId, integration }: SlackIntegrationProps) {
  const handleConnect = () => {
    // Open OAuth popup
    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `/v1/slack/auth/start?agentName=${agentId}`,
      'slack-oauth',
      `width=${width},height=${height},left=${left},top=${top}`,
    );
  };

  const handleDisconnect = async () => {
    await fetch(`/v1/slack/connections/${agentId}/disconnect`, {
      method: 'POST',
    });
    // Refetch integration data
  };

  const handleOpenSlack = () => {
    if (!integration) return;
    const slackUrl = `slack://user?team=${integration.teamId}&id=${integration.botUserId}`;
    window.open(slackUrl, '_blank');
  };

  // Not connected state
  if (!integration || !integration.connected) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SlackIcon width={20} height={20} />
            <h3 className="text-lg font-semibold">Slack Integration</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Connect this agent to a Slack workspace to chat via direct messages and mentions.
          </p>
        </div>
        <Button onClick={handleConnect}>Connect to Slack</Button>
      </div>
    );
  }

  // Connected state
  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <SlackIcon width={20} height={20} />
          <h3 className="text-lg font-semibold">Slack Integration</h3>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm">
            <span className="text-muted-foreground min-w-[120px]">Status:</span>
            <span className="text-green-600">✓ Connected</span>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-muted-foreground min-w-[120px]">Workspace:</span>
            <span>{integration.teamName}</span>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-muted-foreground min-w-[120px]">Team ID:</span>
            <span className="font-mono text-xs">{integration.teamId}</span>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-muted-foreground min-w-[120px]">Bot User ID:</span>
            <span className="font-mono text-xs">{integration.botUserId}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenSlack}>Open in Slack</Button>
          <Button onClick={handleDisconnect} variant="destructive">
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

### Data Fetching Hook Example

```tsx
// In cloud repo: /hooks/useSlackIntegration.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useSlackIntegration(agentId: string) {
  const queryClient = useQueryClient();

  const { data: integration, isLoading } = useQuery({
    queryKey: ['slack-integration', agentId],
    queryFn: async () => {
      const res = await fetch(`/v1/slack/connections/${agentId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch connection');
      return res.json();
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/slack/connections/${agentId}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-integration', agentId] });
    },
  });

  return {
    integration,
    isLoading,
    disconnect: disconnect.mutate,
    isDisconnecting: disconnect.isPending,
  };
}
```

---

## Acceptance Criteria

### Local Playground

- ✅ New "Integrations" tab appears on agent page (alongside Overview, Model Settings, Memory)
- ✅ Tab shows Slack teaser with "Available in Mastra Cloud" message
- ✅ Includes link to https://cloud.mastra.ai/
- ✅ No functional buttons (teaser only)

### Cloud Implementation

- ✅ Supports custom integration components via `integrations` prop
- ✅ Components can manage their own data fetching and state
- ✅ "Not connected" state with "Connect to Slack" button
- ✅ "Connected" state with workspace details and "Open in Slack" + "Disconnect" buttons
- ✅ OAuth popup flow for connecting
- ✅ Connection status persists across page refreshes
- ✅ Slack deep linking to open DM with bot

---

## Files Created

### Playground-UI Package

- `/packages/playground-ui/src/domains/agents/integrations/slack-tab.tsx` (~40 lines)
- `/packages/playground-ui/src/ds/icons/SlackIcon.tsx` (~40 lines)

### Files Modified

- `/packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx` (+3 lines)
- `/packages/playground-ui/src/domains/agents/index.tsx` (+1 line for export)
- `/packages/playground-ui/src/ds/icons/index.ts` (+1 line for export)

### Total Code

- **~85 lines** in playground-ui
- Fully extensible for cloud implementation

---

## Backend Dependencies

The cloud implementation requires these API endpoints:

### 1. Get Connection Status

```
GET /v1/slack/connections/:agentName
Response:
{
  "teamName": "Workspace Name",
  "teamId": "T01234ABCDE",
  "botUserId": "U01234ABCDE",
  "connected": true
}
```

### 2. Start OAuth Flow

```
GET /v1/slack/auth/start?agentName=:agentName
Response: Redirects to Slack OAuth
```

### 3. Disconnect

```
POST /v1/slack/connections/:agentName/disconnect
Response: 204 No Content
```

---

## Slack Deep Linking

The cloud implementation can use Slack deep links to open conversations:

```typescript
// Open DM with bot
const dmUrl = `slack://user?team=${teamId}&id=${botUserId}`;
window.open(dmUrl, '_blank');

// Open channel
const channelUrl = `slack://channel?team=${teamId}&id=${channelId}`;
window.open(channelUrl, '_blank');
```

These URLs work in both Slack desktop app and web browser.

---

## Testing

### Local Playground

1. Navigate to any agent page
2. Click "Integrations" tab
3. Verify Slack teaser is displayed
4. Verify "Sign up" link goes to https://cloud.mastra.ai/

### Cloud Environment

1. Navigate to any agent page
2. Click "Integrations" tab
3. Click "Connect to Slack"
4. OAuth popup opens → authorize
5. Popup closes, status shows "Connected"
6. Refresh page → still shows connected
7. Click "Open in Slack" → Slack opens to bot DM
8. Click "Disconnect" → shows "Not connected"

---

## Benefits of This Architecture

✅ **Separation of Concerns**: Playground-UI doesn't contain cloud-specific logic  
✅ **Flexibility**: Cloud can implement any integration with custom UI and logic  
✅ **Extensibility**: Easy to add more integrations (Discord, Teams, etc.)  
✅ **Reusability**: SlackIcon and patterns can be reused for other integrations  
✅ **Clean API**: Single `integrations` prop, no feature flags needed  
✅ **Progressive Enhancement**: Works in local playground with teaser, full-featured in cloud
