import { mastra } from './mastra';

const chefModelV2 = mastra.getAgent('chefModelV2Agent');

const stream = await chefModelV2.streamVNext([
  {
    role: 'user',
    content: [
      {
        type: 'image',
        image: new URL('https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png'),
      },
      {
        type: 'text',
        text: 'What is this image?',
      },
    ],
  },
]);

const d = await stream.getFullOutput();

console.log(d);
