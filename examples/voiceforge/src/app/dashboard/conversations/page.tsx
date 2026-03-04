'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ConversationList } from '@/components/dashboard/ConversationList';
import { ConversationDetail } from '@/components/dashboard/ConversationDetail';

export default function ConversationsPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 flex">
        {/* Conversations List */}
        <div className="w-96 border-r border-gray-800 overflow-y-auto">
          <div className="p-6 border-b border-gray-800">
            <h1 className="text-2xl font-bold text-white">Conversas</h1>
            <p className="text-sm text-gray-400 mt-1">47 ativas hoje</p>
          </div>
          <ConversationList onSelect={setSelectedConversation} />
        </div>

        {/* Conversation Detail */}
        <div className="flex-1">
          {selectedConversation ? (
            <ConversationDetail conversationId={selectedConversation} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Selecione uma conversa para ver detalhes
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
