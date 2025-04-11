'use client';

import { useRealtimeSession } from '@/hooks/realtime';
import { ToolFallback } from '@mastra/playground-ui';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  renderChartSchema,
  renderDetailsSchema,
  renderListSchema,
  renderTableSchema,
  type RenderChartInput,
  type RenderDetailsInput,
  type RenderListInput,
  type RenderTableInput,
} from '../tools';
import { Button } from './Button';
import { Chart, Details, List, Table } from './UI';
import { createBrowserTool } from '@mastra/client-js';

// const instructions = `You are an expert UI renderer. When the user asks you to render something, make sure to mock any data thats needed.`;
const instructions = `You are a BigQuery data analyst assistant. You help users interact with Google BigQuery.`;

const initialMessage = `Ask the user what they would like to analyze today.`;

export const MastraRealtime = () => {
  const [text, setText] = useState('');
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [chart, setChart] = useState<RenderChartInput | null>(null);
  const [details, setDetails] = useState<RenderDetailsInput | null>(null);
  const [list, setList] = useState<RenderListInput | null>(null);
  const [table, setTable] = useState<RenderTableInput | null>(null);

  const { connectionState, createSession } = useRealtimeSession();

  const handleCreateSession = async () => {
    const browserTools = {
      renderDetails: createBrowserTool({
        id: 'render_details',
        inputSchema: renderDetailsSchema,
        description: 'Render a details page for the user',
        execute: async ({ name, description, attributes }, { connection }) => {
          connection.sendResponse(`Details rendered.`);
          setDetails({ name, description, attributes });

          return {
            message: 'Details rendered',
          };
        },
      }),

      renderList: createBrowserTool({
        id: 'render_list',
        inputSchema: renderListSchema,
        description: 'Render a list for the user',
        execute: async ({ items }, { connection }) => {
          connection.sendResponse(`List rendered.`);
          setList({ items });

          return {
            message: 'List rendered',
          };
        },
      }),

      renderTable: createBrowserTool({
        id: 'render_table',
        inputSchema: renderTableSchema,
        description: 'Render a table for the user',
        execute: async ({ columns, data }, { connection }) => {
          console.log('Table rendered.', columns, data);
          connection.sendResponse(`Table rendered.`);
          setTable({ columns, data });

          return {
            message: 'Table rendered',
          };
        },
      }),

      renderChart: createBrowserTool({
        id: 'render_chart',
        inputSchema: renderChartSchema,
        description: 'Render a chart for the user',
        execute: async ({ data }, { connection }) => {
          connection.sendResponse(`Chart rendered.`);
          setChart({ data });

          return {
            message: 'Chart rendered',
          };
        },
      }),
    };

    await createSession({
      instructions,
      initialMessage,
      onTextPart: text => {
        setText(text as string);
      },
      onToolCallPart: data => {
        setToolCalls(c => [...c, data]);
      },
      onToolResultPart: data => {
        setToolCalls(c => [...c, data]);
      },
      browserTools,
    });
  };

  return (
    <>
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>

      <div className="flex flex-col gap-4 p-2">
        {toolCalls.map((toolCall, index) => (
          <ToolFallback key={index} {...toolCall} />
        ))}
      </div>

      {connectionState === 'connected' ? (
        <>
          {chart && <Chart data={chart.data} />}
          {details && <Details name={details.name} description={details.description} attributes={details.attributes} />}
          {table && <Table columns={table.columns} data={table.data} />}
          {list && <List items={list.items} />}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <Button onClick={handleCreateSession}>
            {connectionState === 'pending' ? 'Creating Session...' : 'Create Session'}
          </Button>
        </div>
      )}
    </>
  );
};
