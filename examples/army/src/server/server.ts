import express, { Request, Response } from 'express';

import { createAnswer, createQuestion, getAnswer } from './db';

const app = express();
app.use(express.json());

app.post('/questions', async (req: Request, res: Response) => {
  const { text } = req.body;
  const question = await createQuestion(text);
  res.json(question);
});

app.get('/questions/:questionId/answer', async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const answer = await getAnswer(questionId);
  if (!answer) {
    res.status(404).json({ error: 'Answer not found' });
    return;
  }
  res.json(answer);
});

app.post('/answers', async (req: Request, res: Response) => {
  const { questionId, text } = req.body;
  const answer = await createAnswer(questionId, text);
  res.json(answer);
});

export const startServer = (port: number) => {
  return new Promise<void>(resolve => {
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      resolve();
    });
  });
};
