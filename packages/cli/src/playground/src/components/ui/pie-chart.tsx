'use client';

import { TrendingUp } from 'lucide-react';
import * as React from 'react';
import { Label, Pie, PieChart } from 'recharts';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export const colors = [
  'hsl(0, 85%, 60%)', // Red
  'hsl(210, 85%, 60%)', // Blue
  'hsl(120, 85%, 60%)', // Green
  'hsl(45, 85%, 60%)', // Orange
  'hsl(280, 85%, 60%)', // Purple
  'hsl(170, 85%, 60%)', // Teal
  'hsl(330, 85%, 60%)', // Pink
  'hsl(90, 85%, 60%)', // Lime
  'hsl(240, 85%, 60%)', // Indigo
  'hsl(30, 85%, 60%)', // Light Orange
  'hsl(300, 85%, 60%)', // Magenta
  'hsl(150, 85%, 60%)', // Spring Green
  'hsl(20, 85%, 60%)', // Coral
  'hsl(260, 85%, 60%)', // Violet
  'hsl(190, 85%, 60%)', // Sky Blue
  'hsl(60, 85%, 60%)', // Yellow
  'hsl(320, 85%, 60%)', // Hot Pink
  'hsl(140, 85%, 60%)', // Sea Green
  'hsl(10, 85%, 60%)', // Vermillion
  'hsl(220, 85%, 60%)', // Royal Blue
];

export function EvalChart({
  evals,
  metricName,
}: {
  evals: {
    result: {
      score: number;
    };
    meta: {
      metricName: string;
      runId: string;
    };
  }[];
  metricName: string;
}) {
  const chartData = evals.map((ev, index) => ({
    testId: ev.meta.runId,
    score: ev.result.score,
    fill: colors[index % colors.length],
  }));

  const totalScore = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.score, 0);
  }, []);

  const averageScore = React.useMemo(() => {
    return totalScore / chartData.length;
  }, [totalScore, chartData]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{metricName}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={{}} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie data={chartData} dataKey="score" nameKey="testId" innerRadius={60} strokeWidth={5}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                          {averageScore.toLocaleString()}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                          {metricName}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
