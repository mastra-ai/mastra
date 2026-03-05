'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: 'R$97',
    period: '/mês',
    description: 'Ideal para testar o piloto',
    features: [
      '1 canal (WhatsApp ou Voz)',
      '500 conversas/mês',
      '1 vertical template',
      'Analytics básico',
      'Suporte email',
    ],
    cta: 'Começar Teste',
    popular: false,
  },
  {
    name: 'Pro',
    price: 'R$297',
    period: '/mês',
    description: 'Para escalar vendas',
    features: [
      '4 canais completos',
      '5.000 conversas/mês',
      '3 verticais custom',
      'Analytics avançado + ROI',
      'Human handoff',
      'Integrações Stripe/Calendly',
      'Suporte prioritário',
    ],
    cta: 'Mais Popular',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'R$997',
    period: '/mês',
    description: 'Operación massiva',
    features: [
      'Conversas ilimitadas',
      'Multi-agência white label',
      'API custom + webhooks',
      'RAG personalizado',
      'SLA 99,9% uptime',
      'Account manager dedicado',
      'Treinamento on-site',
    ],
    cta: 'Falar com Vendas',
    popular: false,
  },
];

export function PricingCards() {
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
            Preços Transparentes
          </h2>
          <p className="text-xl text-gray-400">
            Sem taxas ocultas. Cancele quando quiser.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-gray-800/50 backdrop-blur-sm border rounded-2xl p-8 ${
                plan.popular
                  ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105'
                  : 'border-gray-700/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  Mais Vendido
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 shadow-lg shadow-purple-500/50'
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-gray-400 mt-12"
        >
          Todas as assinaturas incluem 7 dias de teste grátis. Sem cartão necessário.
        </motion.p>
      </div>
    </section>
  );
}
