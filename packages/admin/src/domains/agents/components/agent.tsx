'use client';

import React from 'react';

import { saveAgent } from '../actions';

export const Agent = ({ agents = [] }: { agents: any[] }) => {
  return (
    <div>
      <h1>Agents</h1>
      {agents.map((agent, i) => {
        return <div key={i}>{JSON.stringify(agent, null, 3)}</div>;
      })}
      <button
        onClick={() =>
          saveAgent({
            agentId: crypto.randomUUID(),
            data: {
              name: `Agent ${agents.length + 1}`,
              agentType: 'RAG',
              entities: [],
              indexFields: [],
              vectorStores: [],
              refreshAt: '0 0 * * *',
              prompt: 'How many people are in the photo?',
            },
          })
        }
      >
        Create agent
      </button>
    </div>
  );
};
