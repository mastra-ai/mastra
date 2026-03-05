'use client';

import { Phone, MessageSquare, Globe, Mail, TrendingUp, Clock } from 'lucide-react';

const leads = [
  {
    id: '1',
    name: 'Maria Silva',
    channel: 'whatsapp',
    status: 'hot',
    message: 'Quero agendar consulta amanhã',
    time: '2min atrás',
    score: 92,
  },
  {
    id: '2',
    name: 'João Santos',
    channel: 'voice',
    status: 'warm',
    message: 'Ligou perguntando sobre preços',
    time: '15min atrás',
    score: 78,
  },
  {
    id: '3',
    name: 'Ana Costa',
    channel: 'webchat',
    status: 'cold',
    message: 'Visitou página de serviços',
    time: '1h atrás',
    score: 45,
  },
  {
    id: '4',
    name: 'Pedro Lima',
    channel: 'email',
    status: 'warm',
    message: 'Abriu email de follow-up',
    time: '2h atrás',
    score: 65,
  },
];

const channelIcons = {
  whatsapp: MessageSquare,
  voice: Phone,
  webchat: Globe,
  email: Mail,
};

const statusColors = {
  hot: 'bg-red-500',
  warm: 'bg-orange-500',
  cold: 'bg-blue-500',
};

export function RecentLeads() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Leads Recentes</h3>
        <button className="text-sm text-purple-400 hover:text-purple-300">Ver todos</button>
      </div>

      <div className="space-y-4">
        {leads.map((lead) => {
          const ChannelIcon = channelIcons[lead.channel as keyof typeof channelIcons];
          return (
            <div
              key={lead.id}
              className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            >
              {/* Channel Icon */}
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChannelIcon className="w-5 h-5 text-gray-300" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">{lead.name}</span>
                  <div className={`w-2 h-2 rounded-full ${statusColors[lead.status as keyof typeof statusColors]}`} />
                  <span className="text-xs text-gray-500 uppercase">{lead.status}</span>
                </div>
                <p className="text-sm text-gray-400 truncate">{lead.message}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {lead.time}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <TrendingUp className="w-3 h-3" />
                    Score: {lead.score}
                  </span>
                </div>
              </div>

              {/* Action */}
              <button className="px-3 py-1 bg-purple-500/10 text-purple-400 text-sm rounded-lg hover:bg-purple-500/20 transition-colors">
                Ver
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
