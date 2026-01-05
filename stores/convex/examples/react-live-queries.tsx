/**
 * React Example: Live Queries with Convex
 *
 * This example shows how to use Convex's reactive queries
 * for real-time updates in a React application.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

// ============================================================================
// Live Messages Component
// ============================================================================

interface ChatMessagesProps {
  threadId: string;
}

export function ChatMessages({ threadId }: ChatMessagesProps) {
  // Messages automatically update when they change in the database
  const messages = useQuery(api.mastra.queries.watchMessages, {
    threadId,
    limit: 100,
    order: 'asc',
  });

  if (messages === undefined) {
    return <div className="loading">Loading messages...</div>;
  }

  return (
    <div className="messages">
      {messages.map(msg => (
        <div key={msg.id} className={`message ${msg.role}`}>
          <div className="role">{msg.role}</div>
          <div className="content">{JSON.stringify(msg.content)}</div>
          <div className="time">
            {new Date(msg.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Live Thread Header
// ============================================================================

interface ThreadHeaderProps {
  threadId: string;
}

export function ThreadHeader({ threadId }: ThreadHeaderProps) {
  const thread = useQuery(api.mastra.queries.watchThread, { threadId });
  const messageCount = useQuery(api.mastra.queries.countMessages, { threadId });

  if (!thread) return null;

  return (
    <header className="thread-header">
      <h1>{thread.title || 'Untitled Conversation'}</h1>
      <div className="meta">
        <span>
          {messageCount?.count ?? 0}
          {messageCount?.isEstimate ? '+' : ''} messages
        </span>
        <span>Updated {new Date(thread.updatedAt).toLocaleString()}</span>
      </div>
    </header>
  );
}

// ============================================================================
// User's Thread List with Pagination
// ============================================================================

interface ThreadListProps {
  userId: string;
}

export function ThreadList({ userId }: ThreadListProps) {
  const [cursor, setCursor] = useState<string | undefined>();

  const result = useQuery(api.mastra.queries.paginatedThreads, {
    resourceId: userId,
    cursor,
    limit: 20,
    order: 'desc',
  });

  if (result === undefined) {
    return <div className="loading">Loading threads...</div>;
  }

  return (
    <div className="thread-list">
      <ul>
        {result.items.map(thread => (
          <li key={thread.id}>
            <a href={`/chat/${thread.id}`}>
              <h3>{thread.title || 'Untitled'}</h3>
              <p>{new Date(thread.updatedAt).toLocaleDateString()}</p>
            </a>
          </li>
        ))}
      </ul>

      {result.hasMore && (
        <button
          onClick={() => setCursor(result.nextCursor)}
          className="load-more"
        >
          Load More
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Workflow Status Monitor
// ============================================================================

interface WorkflowStatusProps {
  workflowName: string;
  runId: string;
}

export function WorkflowStatus({ workflowName, runId }: WorkflowStatusProps) {
  const run = useQuery(api.mastra.queries.watchWorkflowRun, {
    workflowName,
    runId,
  });

  if (!run) {
    return <div className="status pending">Pending</div>;
  }

  const status = run.snapshot?.status ?? 'unknown';
  const statusColors: Record<string, string> = {
    pending: 'gray',
    running: 'blue',
    completed: 'green',
    failed: 'red',
    suspended: 'yellow',
  };

  return (
    <div
      className="workflow-status"
      style={{ backgroundColor: statusColors[status] || 'gray' }}
    >
      <span className="status-text">{status}</span>
      {status === 'running' && <span className="spinner">⏳</span>}
    </div>
  );
}

// ============================================================================
// Workflow Runs Dashboard
// ============================================================================

interface WorkflowDashboardProps {
  workflowName?: string;
}

export function WorkflowDashboard({ workflowName }: WorkflowDashboardProps) {
  const [cursor, setCursor] = useState<string | undefined>();

  const result = useQuery(api.mastra.queries.paginatedWorkflowRuns, {
    workflowName,
    cursor,
    limit: 10,
  });

  const count = useQuery(api.mastra.queries.countWorkflowRuns, {
    workflowName,
  });

  return (
    <div className="workflow-dashboard">
      <h2>
        Workflow Runs
        {count && (
          <span className="count">
            ({count.count}{count.isEstimate ? '+' : ''} total)
          </span>
        )}
      </h2>

      <table>
        <thead>
          <tr>
            <th>Workflow</th>
            <th>Run ID</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {result?.items.map(run => (
            <tr key={run.id}>
              <td>{run.workflow_name}</td>
              <td>{run.run_id}</td>
              <td>
                <span className={`status ${run.snapshot?.status}`}>
                  {run.snapshot?.status ?? 'unknown'}
                </span>
              </td>
              <td>{new Date(run.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result?.hasMore && (
        <button onClick={() => setCursor(result.nextCursor)}>
          Load More
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Vector Search Component
// ============================================================================

interface SimilarDocsProps {
  queryEmbedding: number[];
  indexName: string;
}

export function SimilarDocs({ queryEmbedding, indexName }: SimilarDocsProps) {
  const results = useQuery(api.mastra.queries.vectorSearch, {
    indexName,
    queryVector: queryEmbedding,
    topK: 5,
  });

  if (results === undefined) {
    return <div className="loading">Searching...</div>;
  }

  return (
    <div className="similar-docs">
      <h3>Similar Documents</h3>
      <ul>
        {results.map(result => (
          <li key={result.id}>
            <div className="score">
              {(result.score * 100).toFixed(1)}% match
            </div>
            <div className="metadata">
              {JSON.stringify(result.metadata)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Full Chat App Example
// ============================================================================

export function ChatApp() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const userId = 'user-123'; // Get from auth

  return (
    <div className="chat-app">
      {/* Sidebar: Thread List */}
      <aside className="sidebar">
        <h2>Conversations</h2>
        <ThreadList userId={userId} />
      </aside>

      {/* Main: Chat Area */}
      <main className="chat-area">
        {selectedThreadId ? (
          <>
            <ThreadHeader threadId={selectedThreadId} />
            <ChatMessages threadId={selectedThreadId} />
          </>
        ) : (
          <div className="empty-state">
            Select a conversation to start chatting
          </div>
        )}
      </main>
    </div>
  );
}
