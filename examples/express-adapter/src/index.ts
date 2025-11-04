import express from 'express';
import { Mastra } from '@mastra/core/mastra';

import adapter from '@mastra/express-adapter';
import { helloAgent } from './agents';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

export const mastra = new Mastra({
  agents: {
    helloAgent,
  },
});

adapter.registerRoutes({ app, mastra });
