'use client';

import { TrendingUp, TrendingDown, MessageSquare, Phone, DollarSign, Clock } from 'lucide-react';

const metrics = [
  {
    label: 'Leads Hoje',
    value: '47',
    change: '+12%',
    trend: 'up',
    icon: MessageSquare,
    color: 'from-blue-500 to-cyan-600',
  },
  {
    label: 'Agendamentos',
    value: '23',
    change: '+18%',
    trend: 'up',
    icon: Phone,
    color: 'from-green-500 to-emerald-600',
  },
  {
    label: 'Receita Gerada',
    value: 'R$ 1.240',
    change: '+24%',
    trend: 'up',
    icon: DollarSign,
    color: 'from-purple-500 to-pink-600',
  },
  {
    label: 'Tempo Médio',
    value: '1.2min',
    change: '-8%',
    trend: 'down',
    icon: Clock,
    color: 'from-orange-500 to-red-600',
  },
];

export function MetricsCards() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${metric.color} flex items-center justify-center`}>
              <metric.icon className="w-6 h-6 text-white" />
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${
              metric.trend === 'up' ? 'text-green-400' : 'text-red-400'
            }`}>
              {metric.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {metric.change}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">{metric.label}</p>
            <p className="text-3xl font-bold text-white">{metric.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
