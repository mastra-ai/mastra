import './otel.js'; // Initialize OTEL before everything else
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { db, initDb, closeDb } from './db.js';
import { stories, characters, storyOutlines } from './schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({
  logger: true,
});

// Register static file serving for the UI
app.register(fastifyStatic, {
  root: join(__dirname, '../public'),
  prefix: '/',
});

// Request/Response schemas
const createStorySchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
});

const createCharacterSchema = z.object({
  storyId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
});

// Routes
app.post<{ Body: z.infer<typeof createStorySchema> }>('/api/stories', async (request, reply) => {
  const body = createStorySchema.parse(request.body);

  const story = await db
    .insert(stories)
    .values({
      title: body.title,
      prompt: body.prompt,
      content: '',
      status: 'draft',
    })
    .returning();

  return reply.code(201).send(story[0]);
});

app.get<{ Params: { id: string } }>('/api/stories/:id', async (request, reply) => {
  const { id } = request.params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, parseInt(id)),
  });

  if (!story) {
    return reply.code(404).send({ error: 'Story not found' });
  }

  return reply.send(story);
});

app.get('/api/stories', async (request, reply) => {
  const { limit = '10', offset = '0' } = request.query as Record<string, string>;

  const allStories = await db.query.stories.findMany({
    limit: Math.min(parseInt(limit), 100),
    offset: parseInt(offset),
    orderBy: (s) => s.createdAt,
  });

  return reply.send(allStories);
});

app.post<{ Body: z.infer<typeof createCharacterSchema> }>(
  '/api/characters',
  async (request, reply) => {
    const body = createCharacterSchema.parse(request.body);

    const character = await db
      .insert(characters)
      .values({
        storyId: body.storyId,
        name: body.name,
        description: body.description,
      })
      .returning();

    return reply.code(201).send(character[0]);
  }
);

app.get('/api/stories/:id/characters', async (request, reply) => {
  const { id } = request.params as { id: string };

  const storyChars = await db.query.characters.findMany({
    where: eq(characters.storyId, parseInt(id)),
  });

  return reply.send(storyChars);
});

app.put<{ Params: { id: string }; Body: Partial<z.infer<typeof createStorySchema>> }>(
  '/api/stories/:id',
  async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const updated = await db
      .update(stories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, parseInt(id)))
      .returning();

    if (!updated.length) {
      return reply.code(404).send({ error: 'Story not found' });
    }

    return reply.send(updated[0]);
  }
);

app.get('/health', async () => {
  return { status: 'ok' };
});

async function start() {
  try {
    await initDb();

    const port = parseInt(process.env.PORT || '3000');
    await app.listen({ port, host: '0.0.0.0' });

    console.log(`\n✓ Server running on http://localhost:${port}`);
    console.log(`✓ Jaeger UI available on http://localhost:16686`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown() {
  try {
    await app.close();
    await closeDb();
    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
