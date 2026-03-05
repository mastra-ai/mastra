'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Phone, Globe, Mail, Brain, TrendingUp, Zap, Shield } from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'WhatsApp Nativo',
    description: 'Responde em <1min, 24/7. Templates personalizados por vertical.',
    color: 'from-green-500 to-emerald-600',
  },
  {
    icon: Phone,
    title: 'Voz Humanizada',
    description: 'Liga para leads quentes, qualifica em 2min e agenda visitas.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Globe,
    title: 'Web Chat Widget',
    description: 'Embeds em seu site. Captura leads com IA conversacional.',
    color: 'from-purple-500 to-pink-600',
  },
  {
    icon: Mail,
    title: 'Email Follow-Up',
    description: 'Nurturing automático. Reabre leads frios com timing perfeito.',
    color: 'from-orange-500 to-red-600',
  },
  {
    icon: Brain,
    title: 'Memória RAG',
    description: 'Lembra histórico completo. Conversa contextualizada.',
    color: 'from-indigo-500 to-purple-600',
  },
  {
    icon: TrendingUp,
    title: 'Analytics Real-Time',
    description: 'Dashboard com ROI, taxa conversão e heatmaps.',
    color: 'from-teal-500 to-green-600',
  },
  {
    icon: Zap,
    title: 'Human Handoff',
    description: 'Transferência inteligente para casos complexos ou alto valor.',
    color: 'from-yellow-500 to-orange-600',
  },
  {
    icon: Shield,
    title: 'LGPD Compliant',
    description: 'Dados criptografados. Audit logs completos.',
    color: 'from-gray-500 to-slate-600',
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            4 Canais. 1 Cérebro.
          </h2>
          <p className="text-xl text-gray-400">
            Orquestração inteligente via Mastra
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:border-purple-500/50 transition-all hover:scale-105 cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
