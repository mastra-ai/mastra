# To-Do List Example with Memory

This example demonstrates how to build a to-do list application using Mastra memory to track and maintain task state across multiple conversations.

## Overview

We'll build a to-do list agent that can:
- Add new tasks
- Mark tasks as completed
- List pending and completed tasks
- Remember task details and deadlines
- Track task progress across multiple conversations

## Implementation

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { maskStreamTags } from "@mastra/core/utils";
import fs from "fs";

async function main() {
  // Create memory with working memory for tasks
  const memory = new Memory({
    options: {
      workingMemory: {
        enabled: true,
        // Custom template for task management
        template: `<user>
  <name></name>
  <tasks>
    <pending_tasks>
      <!-- Format: <task id="1" deadline="2023-09-10">Task description</task> -->
    </pending_tasks>
    <completed_tasks>
      <!-- Format: <task id="2" completed_date="2023-09-08">Completed task</task> -->
    </completed_tasks>
  </tasks>
</user>`,
        // Use tool-call mode for more reliable task updates
        use: "tool-call",
      },
    },
  });

  // Create a to-do list agent
  const todoAgent = new Agent({
    name: "TodoAgent",
    instructions: `You are a helpful to-do list assistant that helps users manage tasks.
    
    IMPORTANT INSTRUCTIONS:
    1. Maintain a thorough list of the user's tasks in working memory
    2. When a user adds a task, add it to pending_tasks with an ID and deadline (if provided)
    3. When a user completes a task, move it from pending_tasks to completed_tasks
    4. Always provide concise summaries of pending tasks when asked
    5. Keep track of deadlines and remind users of upcoming deadlines
    
    Task Format in Working Memory:
    - Pending: <task id="[number]" deadline="[date]">[description]</task>
    - Completed: <task id="[number]" completed_date="[date]">[description]</task>
    
    Always update working memory when tasks change.`,
    model: openai("gpt-4o"),
    memory: memory,
  });

  // User and task list identifiers
  const resourceId = "user_alex";
  const threadId = "todo_list";

  // First interaction - Add some tasks
  console.log("\n=== Session 1: Adding Tasks ===");
  console.log("User: Hi, I need to organize my tasks. Can you help me create a to-do list?");
  
  await streamResponse(todoAgent, "Hi, I need to organize my tasks. Can you help me create a to-do list?", resourceId, threadId);

  console.log("\nUser: I need to finish my project proposal by Friday, call the dentist to schedule an appointment, and buy groceries.");
  
  await streamResponse(todoAgent, "I need to finish my project proposal by Friday, call the dentist to schedule an appointment, and buy groceries.", resourceId, threadId);

  // Second interaction - Check tasks
  console.log("\n=== Session 2: Checking Tasks ===");
  console.log("User: What tasks do I have on my to-do list?");
  
  await streamResponse(todoAgent, "What tasks do I have on my to-do list?", resourceId, threadId);

  // Third interaction - Mark task as complete
  console.log("\n=== Session 3: Completing Tasks ===");
  console.log("User: I bought groceries. Please mark that as complete.");
  
  await streamResponse(todoAgent, "I bought groceries. Please mark that as complete.", resourceId, threadId);

  console.log("\nUser: What's left on my list?");
  
  await streamResponse(todoAgent, "What's left on my list?", resourceId, threadId);

  // Fourth interaction - Add a task with specific deadline
  console.log("\n=== Session 4: Adding Tasks with Deadlines ===");
  console.log("User: Please add 'Prepare presentation slides' to my list. It's due on Monday at 9am.");
  
  await streamResponse(todoAgent, "Please add 'Prepare presentation slides' to my list. It's due on Monday at 9am.", resourceId, threadId);

  // Fifth interaction - Check working memory
  console.log("\n=== Working Memory State ===");
  const workingMemory = await memory.getWorkingMemory({ resourceId });
  console.log(workingMemory.memory);
  
  // Save for reference
  fs.writeFileSync("todo-list-memory.xml", workingMemory.memory);
  console.log("Working memory saved to todo-list-memory.xml");
}

// Helper function to stream responses with working memory masking
async function streamResponse(agent, message, resourceId, threadId) {
  const response = await agent.stream(message, {
    resourceId,
    threadId,
  });

  process.stdout.write("Agent: ");
  for await (const chunk of maskStreamTags(response.textStream, "working_memory")) {
    process.stdout.write(chunk);
  }
  console.log("\n");
}

// Run the example
main().catch(console.error);
```

## Expected Output

```
=== Session 1: Adding Tasks ===
User: Hi, I need to organize my tasks. Can you help me create a to-do list?
Agent: I'd be happy to help you organize your tasks! To get started, just tell me what tasks you need to add to your to-do list, and I'll keep track of them for you. You can also include deadlines if you have specific dates in mind.

User: I need to finish my project proposal by Friday, call the dentist to schedule an appointment, and buy groceries.
Agent: I've added these tasks to your to-do list:

1. Finish project proposal (Deadline: Friday)
2. Call dentist to schedule an appointment
3. Buy groceries

Is there anything else you'd like to add to your list?

=== Session 2: Checking Tasks ===
User: What tasks do I have on my to-do list?
Agent: Here are your current pending tasks:

1. Finish project proposal (Deadline: Friday)
2. Call dentist to schedule an appointment
3. Buy groceries

You have 3 tasks pending. Would you like to add more tasks or mark any as complete?

=== Session 3: Completing Tasks ===
User: I bought groceries. Please mark that as complete.
Agent: Great job! I've marked "Buy groceries" as complete.

Your updated to-do list:
1. Finish project proposal (Deadline: Friday)
2. Call dentist to schedule an appointment

You now have 2 pending tasks and 1 completed task.

User: What's left on my list?
Agent: Here are your remaining pending tasks:

1. Finish project proposal (Deadline: Friday)
2. Call dentist to schedule an appointment

You have 2 tasks left to complete.

=== Session 4: Adding Tasks with Deadlines ===
User: Please add 'Prepare presentation slides' to my list. It's due on Monday at 9am.
Agent: I've added the new task to your to-do list:

Your current pending tasks:
1. Finish project proposal (Deadline: Friday)
2. Call dentist to schedule an appointment
3. Prepare presentation slides (Deadline: Monday, 9am)

You now have 3 pending tasks and 1 completed task.

=== Working Memory State ===
<user>
  <name>Alex</name>
  <tasks>
    <pending_tasks>
      <task id="1" deadline="Friday">Finish project proposal</task>
      <task id="2">Call dentist to schedule an appointment</task>
      <task id="3" deadline="Monday, 9am">Prepare presentation slides</task>
    </pending_tasks>
    <completed_tasks>
      <task id="3" completed_date="today">Buy groceries</task>
    </completed_tasks>
  </tasks>
</user>

Working memory saved to todo-list-memory.xml
```

## How It Works

1. **Structured Task Storage**: We use working memory with a custom template to store task information in an organized XML format.
2. **Task Management Instructions**: We give the agent specific instructions about how to manage tasks in the working memory structure.
3. **Tool-Call Mode**: We use tool-call mode for more reliable working memory updates, especially important for structured data like tasks.
4. **Persistent State**: Task state persists across multiple conversation sessions, allowing users to add and complete tasks over time.
5. **Task Metadata**: We store metadata like task IDs, deadlines, and completion dates along with task descriptions.

## Web Application Integration

In a real-world web application, you could extend this example:

```typescript
// API endpoint for todo list management
async function todoHandler(req, res) {
  const { message, userId } = req.body;
  
  // Use userId as resourceId and a fixed threadId for the todo list
  const resourceId = `user_${userId}`;
  const threadId = `todo_list_${userId}`;
  
  const response = await todoAgent.stream(message, {
    resourceId, 
    threadId
  });
  
  // Stream response to client with working memory masked
  return streamToResponse(
    maskStreamTags(response.textStream, "working_memory"),
    res
  );
}

// Function to get task data for UI display
async function getTasks(userId) {
  const resourceId = `user_${userId}`;
  const { memory: workingMemory } = await memory.getWorkingMemory({ resourceId });
  
  // Parse XML to extract task data
  const tasks = parseTasksFromXML(workingMemory);
  
  return {
    pendingTasks: tasks.pending,
    completedTasks: tasks.completed
  };
}
```

## UI Example

A simple React component for the to-do list UI:

```jsx
function TodoApp() {
  const [tasks, setTasks] = useState({ pending: [], completed: [] });
  const [input, setInput] = useState("");
  
  // Load tasks on component mount
  useEffect(() => {
    async function loadTasks() {
      const userData = await getTasks(userId);
      setTasks(userData);
    }
    
    loadTasks();
  }, []);
  
  // Send message to todo agent
  const handleSend = async () => {
    // Send message to API
    await sendMessage(input);
    
    // Reload tasks
    const updatedTasks = await getTasks(userId);
    setTasks(updatedTasks);
    
    setInput("");
  };
  
  return (
    <div className="todo-app">
      <h1>Task Manager</h1>
      
      <div className="task-lists">
        <div className="pending-tasks">
          <h2>Pending Tasks</h2>
          <ul>
            {tasks.pending.map(task => (
              <li key={task.id}>
                {task.text}
                {task.deadline && <span className="deadline">Due: {task.deadline}</span>}
                <button onClick={() => completeTask(task.id)}>Complete</button>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="completed-tasks">
          <h2>Completed Tasks</h2>
          <ul>
            {tasks.completed.map(task => (
              <li key={task.id}>
                <s>{task.text}</s>
                <span className="completion-date">Done: {task.completedDate}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="input-area">
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task or ask about your tasks..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

## Related Examples

- [Working Memory Example](./working-memory.md): More details on working memory
- [Frontend Example](./frontend.md): Integrating memory with web UIs
- [Conversation Example](./conversation.md): Basic memory usage
``` 