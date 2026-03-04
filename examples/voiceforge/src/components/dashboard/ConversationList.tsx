'use client';

import { MessageSquare, Phone } from 'lucide-react';

const conversations = [
  { id: '1', name: 'Maria Silva', channel: 'whatsapp', lastMsg: 'Perfeito! Obrigada', time: '2min', unread: 0, hot: true },
  { id: '2', name: 'João Santos', channel: 'voice', lastMsg: 'Ligação finalizada', time: '15min', unread: 1, hot: true },
  { id: '3', name: 'Ana Costa', channel: 'whatsapp', lastMsg: 'Quanto custa?', time: '1h', unread: 2, hot: false },
  { id: '4', name: 'Pedro Lima', channel: 'whatsapp', lastMsg: 'Vou pensar', time: '2h', unread: 0, hot: false },
  { id: '5', name: 'Carla Mendes', channel: 'voice', lastMsg: 'Atendida', time: '3h', unread: 0, hot: false },
];

interface ConversationListProps {
  onSelect: (id: string) => void;
}

export function ConversationList({ onSelect }: ConversationListProps) {
  return (
    <div>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className="p-4 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
              {conv.channel === 'whatsapp' ? (
                <MessageSquare className="w-5 h-5 text-white" />
              ) : (
                <Phone className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white">{conv.name}</span>
                <span className="text-xs text-gray-500">{conv.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400 truncate">{conv.lastMsg}</p>
                {conv.unread > 0 && (
                  <span className="ml-2 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                    {conv.unread}
                  </span>
                )}
              </div>
              {conv.hot && (
                <div className="mt-1 inline-flex items-center gap-1 bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded">
                  🔥 Quente
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
