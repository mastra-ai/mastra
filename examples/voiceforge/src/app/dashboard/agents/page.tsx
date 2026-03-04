'use client';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { AgentConfig } from '@/components/dashboard/AgentConfig';

const agents = [
  { id: 'whatsapp', name: 'WhatsApp Agent', status: 'active', conversations: 1247, avgResponse: '0.8s' },
  { id: 'voice', name: 'Voice Agent', status: 'active', conversations: 389, avgResponse: '2.1s' },
  { id: 'webchat', name: 'Web Chat', status: 'paused', conversations: 523, avgResponse: '1.2s' },
  { id: 'email', name: 'Email Agent', status: 'active', conversations: 156, avgResponse: '45s' },
];

export default function AgentsPage() {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Agentes</h1>
          <p className="text-gray-400">Configure e monitore seus agentes de IA</p>
        </div>

        {/* Agents Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Configuration */}
        <AgentConfig />
      </main>
    </div>
  );
}
