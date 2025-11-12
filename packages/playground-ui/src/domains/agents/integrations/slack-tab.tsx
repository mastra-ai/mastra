import { SlackIcon } from '@/ds/icons';

interface SlackTabProps {
  agentName?: string;
}

/**
 * Slack Integration Tab (Teaser for Local Playground)
 * This is a simple teaser shown in the local playground.
 * In Cloud, you can create your own SlackTab component with full functionality
 * and pass it to AgentInformation via the integrations prop.
 */
export function SlackTab({ agentName }: SlackTabProps) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <SlackIcon width={20} height={20} />
        <h3 className="text-lg font-semibold">Slack Integration</h3>
      </div>
      <p className="text-sm text-mastra-el-3 mb-4">
        Connect your agents to Slack workspaces to chat via direct messages and mentions.
      </p>
      <div className="bg-surface2 border border-border1 rounded-lg p-4">
        <p className="text-sm text-mastra-el-3">
          <span className="font-semibold text-mastra-el-6">Available in Mastra Cloud.</span>{' '}
          <a 
            href="https://cloud.mastra.ai/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:text-mastra-el-6"
          >
            Sign up
          </a>
          {' '}to connect your agents to Slack.
        </p>
      </div>
    </div>
  );
}

