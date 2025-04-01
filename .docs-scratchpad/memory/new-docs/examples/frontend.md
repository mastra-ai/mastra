# Memory-Enabled Chat Frontend Example

This example demonstrates how to build a complete chat interface with Mastra's memory system using Next.js and the AI SDK.

## Overview

We'll create a chat application that:
- Maintains conversation history using Mastra Memory
- Associates chats with specific users
- Supports multiple conversation threads
- Uses working memory to remember user preferences

## Project Structure

```
/app
  /api
    /chat/route.ts       # API endpoint for chat
    /threads/route.ts    # API endpoint for threads
  /chat/[threadId]/page.tsx  # Thread-specific chat page
  /page.tsx              # Home page with thread list
/components
  /Chat.tsx              # Chat UI component
  /ThreadList.tsx        # Thread listing component
/lib
  /mastra.ts             # Mastra and agent setup
  /auth.ts               # Authentication helpers
```

## Step 1: Configure Mastra with Memory

First, let's set up our Mastra agent with memory support:

```typescript
// lib/mastra.ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";
import { openai } from "@ai-sdk/openai";

// Configure memory with PostgreSQL for production use
export const memory = new Memory({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  vector: new PgVector({
    connectionString: process.env.DATABASE_URL!,
  }),
  embedder: openai.embedding("text-embedding-3-small"),
  options: {
    lastMessages: 30,
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
    workingMemory: {
      enabled: true,
      use: "tool-call", // Required for streaming compatibility
    },
  },
});

// Create agent with memory
export const chatAgent = new Agent({
  name: "AssistantAgent",
  instructions: `You are a helpful assistant that remembers context from previous conversations.
  Remember user preferences and important details without asking repeatedly.`,
  model: openai("gpt-4o"),
  memory,
});
```

## Step 2: Create Chat API Endpoint

Next, create the API route that will handle chat interactions:

```typescript
// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { chatAgent } from "@/lib/mastra";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Get user session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse request
  const { message, threadId } = await request.json();

  // Use the user's ID as the resource ID
  const resourceId = `user_${session.user.id}`;

  // Stream the response with memory
  const stream = await chatAgent.stream(message.content, {
    threadId: threadId || crypto.randomUUID(),
    resourceId,
  });

  // Return streaming response
  return stream.toDataStreamResponse();
}
```

## Step 3: Create Thread Management API

Let's add an endpoint to manage threads:

```typescript
// app/api/threads/route.ts
import { NextRequest } from "next/server";
import { memory } from "@/lib/mastra";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Get user session
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get user's resource ID
  const resourceId = `user_${session.user.id}`;

  // Retrieve threads for this user
  const threads = await memory.getThreadsByResourceId({ resourceId });

  return Response.json(threads);
}

// Create a new thread
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { title } = await request.json();
  const resourceId = `user_${session.user.id}`;

  const thread = await memory.createThread({
    resourceId,
    title: title || "New conversation",
  });

  return Response.json(thread);
}
```

## Step 4: Create Chat Component

Now, create the main Chat UI component:

```tsx
// components/Chat.tsx
"use client";

import { useChat } from "ai/react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Chat({ threadId }: { threadId: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Initialize chat with AI SDK's useChat
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    experimental_prepareRequestBody({ messages, id }) {
      // This sends only the latest message to the server
      return { 
        message: messages.at(-1), 
        threadId: id || threadId 
      };
    },
    id: threadId, // Use thread ID for chat ID
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[80vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            Start a conversation...
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.role === "user" ? "bg-blue-100 ml-auto" : "bg-gray-100"
              } rounded-lg p-3 max-w-[80%]`}
            >
              {message.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

## Step 5: Create Thread List Component

Add a component to display all conversation threads:

```tsx
// components/ThreadList.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function ThreadList() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load threads on mount
  useEffect(() => {
    async function loadThreads() {
      try {
        const response = await fetch("/api/threads");
        if (!response.ok) throw new Error("Failed to fetch threads");
        const data = await response.json();
        setThreads(data);
      } catch (error) {
        console.error("Error loading threads:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadThreads();
  }, []);

  // Create a new thread
  const createNewThread = async () => {
    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });

      if (!response.ok) throw new Error("Failed to create thread");
      
      const thread = await response.json();
      router.push(`/chat/${thread.id}`);
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  if (isLoading) return <div>Loading conversations...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Your Conversations</h2>
        <button
          onClick={createNewThread}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          New Chat
        </button>
      </div>

      {threads.length === 0 ? (
        <div className="text-gray-500">No conversations yet</div>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.id} className="border rounded p-3 hover:bg-gray-50">
              <Link href={`/chat/${thread.id}`} className="block">
                <div className="font-medium">{thread.title || "Untitled"}</div>
                <div className="text-sm text-gray-500">
                  {new Date(thread.updatedAt).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Step 6: Create Pages

Finally, create the home page and chat page:

```tsx
// app/page.tsx
import ThreadList from "@/components/ThreadList";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Memory-Enabled Chat</h1>
      <ThreadList />
    </main>
  );
}
```

```tsx
// app/chat/[threadId]/page.tsx
import Chat from "@/components/Chat";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { memory } from "@/lib/mastra";

export default async function ChatPage({
  params,
}: {
  params: { threadId: string };
}) {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session) {
    redirect("/api/auth/signin");
  }

  // Verify thread exists and belongs to user
  const thread = await memory.getThreadById({ threadId: params.threadId });
  
  if (!thread || thread.resourceId !== `user_${session.user.id}`) {
    redirect("/");
  }

  return (
    <main className="container mx-auto p-6 max-w-4xl h-screen flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{thread.title || "Chat"}</h1>
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Threads
        </Link>
      </div>
      <Chat threadId={params.threadId} />
    </main>
  );
}
```

## Key Takeaways

1. **Single Message Approach**: Always send only the latest message to prevent duplicate messages in memory

2. **User-Thread Association**: Use the user's ID as the resourceId to organize threads by user

3. **Thread Management**: Create a dedicated API for thread operations

4. **Authentication Integration**: Always check authentication before accessing threads

5. **Working Memory**: Configure working memory for better context retention:
   ```typescript
   options: {
     workingMemory: {
       enabled: true,
       use: "tool-call", // For streaming compatibility
     },
   }
   ```

## Next Steps

- Add authentication with a service like NextAuth.js
- Implement deletion and archiving of threads
- Add more sophisticated thread management UI
- Implement working memory to store user preferences

## Related Documentation

- [Frontend Integration Guide](../3-using-memory/3.4-frontend-integration.md)
- [Memory Threads](../4-memory-threads/index.md)
- [Working Memory](../3-using-memory/3.3-working-memory.md)
- [Authentication with Memory](../4-memory-threads/4.5-auth.md) 