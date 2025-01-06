import { config } from 'dotenv';
import express, { Request, Response } from 'express';
import { z } from 'zod';

import { getRandomImage, ImageQuery } from './lib/utils';
import { mastra } from './mastra/index';

config();

const app = express();

app.use(express.json());

const port = process.env.PORT || 3001;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript Express!');
});

app.get('/api/get-unsplash-image', async (req: Request, res: Response) => {
  try {
    const imageQuery = (req?.query?.query || 'wildlife') as ImageQuery;

    const image = await getRandomImage({ query: imageQuery });

    if (!image.ok) {
      res.status(400).send({ msg: image.error });
      return;
    }

    res.send(image.data);
  } catch (err) {
    console.log('get unsplash image err===', err);
    res.status(400).send({ msg: 'Could not fetch image' });
  }
});

app.post('/api/image-metadata', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.body?.imageUrl;

    if (!imageUrl) {
      res.status(400).send({ msg: 'Image url is required' });
      return;
    }

    const birdCheckerAgent = mastra.getAgent('birdCheckerAgent');

    if (!birdCheckerAgent) {
      res.sendStatus(404);
      return;
    }

    const response = await birdCheckerAgent.generate(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: imageUrl,
            },
            {
              type: 'text',
              text: "view this image and let me know if it's a bird or not, and the scientific name of the bird without any explanation. Also summarize the location for this picture in one or two short sentences understandable by a high school student",
            },
          ],
        },
      ],
      {
        output: z.object({
          bird: z.boolean(),
          species: z.string(),
          location: z.string(),
        }),
      },
    );

    const { object } = response;

    console.log('response==', JSON.stringify(object, null, 2));

    res.send(object);
  } catch (err) {
    console.log('get image metadata err===', err);
    res.status(400).send({ msg: 'Could not fetch image metadata' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
