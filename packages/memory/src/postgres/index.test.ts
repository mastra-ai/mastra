import { PgMemory } from './';

// Set up the test database connection
const connectionString = 'postgresql://postgres:postgres@localhost:5434/mastra';

describe('PgMastraMemory', () => {
    let memory: PgMemory;

    beforeAll(async () => {
        memory = new PgMemory(connectionString);
    });

    afterAll(async () => {
        await memory.drop()
    })

    it('should create and retrieve a thread', async () => {
        const thread = await memory.createThread('Test Thread', { test: true });
        const retrievedThread = await memory.getThreadById(thread.id);
        expect(retrievedThread).toEqual(thread);
    });

    it('should save and retrieve messages', async () => {
        const thread = await memory.createThread('Test Thread 2', { test: true });
        const message1 = await memory.addMessage(thread.id, 'Hello', 'user');
        // const message2 = await memory.addMessage(thread.id, 'World', 'assistant');
        const messages = await memory.getMessages(thread.id);

        console.log(messages)
        expect(messages[0]?.content).toEqual(message1.content);
    });

    it('should update a thread', async () => {
        const thread = await memory.createThread('Initial Thread Title', { test: true });
        const updatedThread = await memory.updateThread(thread.id, 'Updated Thread Title', { test: true, updated: true });

        expect(updatedThread.title).toEqual('Updated Thread Title');
        expect(updatedThread.metadata).toEqual({ test: true, updated: true });
    });

    it('should delete a thread', async () => {
        const thread = await memory.createThread('Thread to Delete', { test: true });
        await memory.deleteThread(thread.id);

        const retrievedThread = await memory.getThreadById(thread.id);
        expect(retrievedThread).toBeNull();
    });

    it('should delete a message', async () => {
        const thread = await memory.createThread('Thread with Message', { test: true });
        const message = await memory.addMessage(thread.id, 'Message to Delete', 'user');
        await memory.deleteMessage(message.id);

        const messages = await memory.getMessages(thread.id);
        expect(messages.length).toEqual(0);
    });
});