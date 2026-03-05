'use client';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { ConversationsChart } from '@/components/dashboard/ConversationsChart';
import { RecentLeads } from '@/components/dashboard/RecentLeads';
import { ChannelDistribution } from '@/components/dashboard/ChannelDistribution';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Visão geral dos seus agentes em tempo real</p>
        </div>

        {/* Metrics */}
        <MetricsCards />

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <ConversationsChart />
          <ChannelDistribution />
        </div>

        {/* Recent Activity */}
        <RecentLeads />
      </main>
    </div>
  );
}
