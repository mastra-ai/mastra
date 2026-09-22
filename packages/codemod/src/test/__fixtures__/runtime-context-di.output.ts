// @ts-nocheck

import { RequestContext } from '@mastra/core/request-context';

type WeatherContext = {
  'temperature-scale': 'celsius' | 'fahrenheit';
};

const requestContext = new RequestContext<WeatherContext>();
requestContext.set('temperature-scale', 'celsius');

const response = await agent.generate("What's the weather like today?", {
  requestContext,
});
