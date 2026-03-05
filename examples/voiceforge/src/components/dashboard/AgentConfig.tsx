'use client';

import { Save, RotateCcw } from 'lucide-react';

export function AgentConfig() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-xl font-semibold text-white mb-6">Configuração Global</h3>

      <div className="space-y-6">
        {/* LLM Model */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Modelo LLM</label>
          <select className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500">
            <option>Qwen3-Coder-Next (Recomendado)</option>
            <option>GLM-5 Plus</option>
            <option>Claude 3.5 Sonnet</option>
            <option>GPT-4o</option>
          </select>
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Temperature: <span className="text-purple-400">0.7</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            defaultValue="0.7"
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Preciso</span>
            <span>Criativo</span>
          </div>
        </div>

        {/* Handoff Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Threshold Handoff Humano: <span className="text-purple-400">80%</span>
          </label>
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            defaultValue="80"
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">System Prompt Global</label>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 font-mono text-sm"
            rows={6}
            defaultValue={`Você é um assistente de vendas especializado em qualificar leads e agendar reuniões.

Diretrizes:
- Seja profissional mas amigável
- Qualifique ICP (orçamento, timing, autoridade)
- Agende demo em até 2min de conversa
- Handoff para humano se score >80`}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold">
            <Save className="w-5 h-5" />
            Salvar Alterações
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
            <RotateCcw className="w-5 h-5" />
            Resetar
          </button>
        </div>
      </div>
    </div>
  );
}
