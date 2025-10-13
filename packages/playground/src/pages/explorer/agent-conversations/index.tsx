import { Link } from 'react-router';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useAllAgentConversations } from '@/hooks/use-all-agent-conversations';
import { AgentConversationsTable } from '@/components/agent-conversations-table';

export default function AgentConversations() {
  const { data: conversations = [], isLoading } = useAllAgentConversations();

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border1 px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/explorer" className="text-text3 hover:text-text1 transition-colors" title="Back to Explorer">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-icon3" />
            <h1 className="text-2xl font-semibold text-text1">Agent Conversations</h1>
          </div>
        </div>
        <p className="text-sm text-text3 ml-8">View and explore all agent conversations with memory enabled</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <AgentConversationsTable conversations={conversations} isLoading={isLoading} />
      </div>
    </div>
  );
}
