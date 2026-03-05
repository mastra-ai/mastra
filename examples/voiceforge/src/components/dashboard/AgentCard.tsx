'use client';

import { MoreVertical, Play, Pause, Activity } from 'lucide-react';

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    status: 'active' | 'paused' | 'error';
    conversations: number;
    avgResponse: string;
  };
}

const statusConfig = {
  active: { color: 'bg-green-500', label: 'Ativo' },
  paused: { color: 'bg-yellow-500', label: 'Pausado' },
  error: { color: 'bg-red-500', label: 'Erro' },
};

export function AgentCard({ agent }: AgentCardProps) {
  const status = statusConfig[agent.status];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${status.color} animate-pulse`} />
            <span className="text-xs text-gray-400 uppercase">{status.label}</span>
          </div>
          <h3 className="text-xl font-semibold text-white">{agent.name}</h3>
        </div>
        <button className="text-gray-400 hover:text-white">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">Conversas</p>
          <p className="text-2xl font-bold text-white">{agent.conversations}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400 mb-1">Resposta Média</p>
          <p className="text-2xl font-bold text-white">{agent.avgResponse}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {agent.status === 'active' ? (
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Pause className="w-4 h-4" />
            Pausar
          </button>
        ) : (
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            <Play className="w-4 h-4" />
            Ativar
          </button>
        )}
        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors">
          <Activity className="w-4 h-4" />
          Logs
        </button>
      </div>
    </div>
  );
}
