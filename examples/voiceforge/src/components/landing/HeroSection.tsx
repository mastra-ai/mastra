'use client';

import { motion } from 'framer-motion';
import { Sparkles, Zap, TrendingUp } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-green-500/20 animate-pulse" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-8"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300">Powered by Mastra AI Framework</span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight"
        >
          Seu Time de Vendas IA
          <br />
          <span className="bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Que Nunca Dorme
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto"
        >
          WhatsApp + Voz + Web Chat.
          <br />
          <span className="text-green-400 font-semibold">100 leads qualificados/dia</span> em piloto automático.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button className="group relative px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold text-lg shadow-2xl shadow-green-500/50 hover:shadow-green-500/70 transition-all hover:scale-105">
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Teste Grátis 7 Dias
            </span>
          </button>

          <button className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-lg font-semibold text-lg hover:bg-white/10 transition-all">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Ver Demo 30s
            </span>
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
        >
          {[
            { label: 'Conversão', value: '+340%' },
            { label: 'Economia', value: '70%' },
            { label: 'Resposta', value: '<1min' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold text-green-400">{stat.value}</div>
              <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
