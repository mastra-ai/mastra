'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';

export function InteractiveDemo() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    // Simulate agent response
    setTimeout(() => {
      let response = '';
      const lower = userMsg.toLowerCase();

      if (lower.includes('agendar') || lower.includes('consulta')) {
        response = 'Perfeito! 📅 Para qual dia prefere? Temos horários disponíveis amanhã 14:00 e sexta 10:00.';
      } else if (lower.includes('preço') || lower.includes('quanto')) {
        response = 'Nossa consulta inicial é R$150. Aceita convênios Unimed e SulAmérica. Quer agendar?';
      } else if (lower.includes('oi') || lower.includes('olá')) {
        response = 'Olá! 👋 Sou a assistente virtual. Como posso ajudar hoje?';
      } else {
        response = 'Entendi! Posso agendar uma consulta ou tirar dúvidas sobre nossos serviços. O que prefere?';
      }

      setMessages((prev) => [...prev, { role: 'agent', text: response }]);
      setLoading(false);
    }, 1500);
  };

  return (
    <section className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl font-bold text-white mb-4">Teste Agora</h2>
          <p className="text-xl text-gray-400">Converse com nosso agente demo</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
        >
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                🤖
              </div>
              <div>
                <h3 className="text-white font-semibold">Assistente VoiceForge</h3>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-xs text-white/80">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="mb-2">👋</p>
                  <p>Digite algo para começar</p>
                  <p className="text-sm mt-2">Experimente: "Quero agendar consulta"</p>
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-sm px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-gray-800 px-4 py-3 rounded-2xl flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-gray-400">Digitando...</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-gray-500 text-sm mt-6"
        >
          🔒 Seus dados são privados e não são armazenados nesta demo
        </motion.p>
      </div>
    </section>
  );
}
