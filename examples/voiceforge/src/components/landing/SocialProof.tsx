'use client';

import { motion } from 'framer-motion';

const testimonials = [
  {
    company: 'Clínica Sorriso Perfeito',
    metric: '340% ROI',
    quote: '47 agendamentos/semana sem equipe de atendimento',
    logo: '🦷',
  },
  {
    company: 'Imob Premium SP',
    metric: '89 visitas/semana',
    quote: 'Leads qualificados 24/7, fechamos 3x mais negócios',
    logo: '🏠',
  },
  {
    company: 'Loja Bella Moda',
    metric: '50% menos churn',
    quote: 'Carrinhos abandonados recuperados automaticamente',
    logo: '👗',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 px-6 border-y border-white/10">
      <div className="max-w-7xl mx-auto">
        <motion.h3
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-gray-400 mb-12 text-sm uppercase tracking-wider"
        >
          Resultados Reais de PMEs Brasileiras
        </motion.h3>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:border-green-500/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">{item.logo}</div>
                <div>
                  <div className="font-semibold text-white">{item.company}</div>
                  <div className="text-2xl font-bold text-green-400">{item.metric}</div>
                </div>
              </div>
              <p className="text-gray-300 italic">“{item.quote}”</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
