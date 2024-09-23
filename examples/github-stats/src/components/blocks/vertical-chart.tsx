'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts';

import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type ChartData = {
  label: string;
  value: number;
}[];

export function VerticalChart({ chartData, chartConfig }: { chartData: ChartData; chartConfig: ChartConfig }) {
  return (
    <ChartContainer config={chartConfig}>
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{
          top: 20,
        }}
        layout="horizontal"
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false} />

        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Bar dataKey="value" layout="vertical" fill="var(--color-value)" radius={4}>
          <LabelList position="top" offset={12} fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
