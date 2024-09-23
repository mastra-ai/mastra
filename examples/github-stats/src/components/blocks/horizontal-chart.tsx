'use client';

import React from 'react';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';

import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type ChartData = {
  label: string;
  value: number;
}[];

export function HorizontalChart({ chartData, chartConfig }: { chartData: ChartData; chartConfig: ChartConfig }) {
  return (
    <ChartContainer config={chartConfig}>
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{
          left: 50,
        }}
      >
        <XAxis type="number" dataKey="value" hide />
        <YAxis dataKey="label" type="category" tickLine={false} tickMargin={10} axisLine={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={5}>
          <LabelList position="right" offset={12} fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
