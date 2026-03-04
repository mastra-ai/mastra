'use client';

import { Send, Phone, Video, MoreVertical, Play } from 'lucide-react';

const messages = [
  { id: '1', sender: 'user', text: 'Oi, quero agendar uma consulta', time: '14:23' },
  { id: '2', sender: 'agent', text: 'Olá Maria! 👋 Claro, posso ajudar. Para qual especialidade?', time: '14:23' },
  { id: '3', sender: 'user', text: 'Dentista, limpeza', time: '14:24' },
  { id: '4', sender: 'agent', text: 'Perfeito! Temos horários disponíveis:\n\n1️⃣ Amanhã 14:00\n2️⃣ Sexta 10:00\n3️⃣ Sexta 16:00\n\nQual prefere?', time: '14:24' },
  { id: '5', sender: 'user', text: '1', time: '14:25' },
  { id: '6', sender: 'agent', text: 'Agendado! ✅\n\n📅 Quinta 05/03\n🕐 14:00\n📍 Clínica Centro\n\nEnviaremos lembrete 1h antes. Até lá! 😊', time: '14:25' },
];

interface ConversationDetailProps {
  conversationId: string;
}

export function ConversationDetail({ conversationId }: ConversationDetailProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-semibold text-white">Maria Silva</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm text-gray-400">Online</span>
            <span className="text-xs text-gray-500">• Score: 92 🔥</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <Phone className="w-5 h-5 text-gray-300" />
          </button>
          <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <Video className="w-5 h-5 text-gray-300" />
          </button>
          <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-md px-4 py-3 rounded-2xl ${
                msg.sender === 'user'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <span className="text-xs opacity-70 mt-1 block">{msg.time}</span>
            </div>
          </div>
        ))}

        {/* Voice Message Example */}
        <div className="flex justify-start">
          <div className="bg-gray-800 rounded-2xl p-4 max-w-md">
            <div className="flex items-center gap-3">
              <button className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors">
                <Play className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <div className="h-8 bg-gray-700 rounded-lg flex items-center px-2">
                  <div className="flex gap-0.5 items-end h-full">
                    {[4, 8, 6, 10, 7, 5, 9, 6, 8, 4].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-purple-400 rounded-full"
                        style={{ height: `${h * 10}%` }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400 mt-1 block">0:23</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-800">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
          />
          <button className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 font-semibold">
            <Send className="w-5 h-5" />
            Enviar
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          🤖 Agent pausado - modo manual ativo
        </p>
      </div>
    </div>
  );
}
