// @ts-nocheck

import { RuntimeContext } from '@mastra/core/di';

type WeatherContext = {
  'temperature-scale': 'celsius' | 'fahrenheit';
};

const runtimeContext = new RuntimeContext<WeatherContext>();
runtimeContext.set('temperature-scale', 'celsius');

const response = await agent.generate("What's the weather like today?", {
  runtimeContext,
});
