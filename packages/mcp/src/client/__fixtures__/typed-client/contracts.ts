export interface MCPServers {
  weather: {
    tools: {
      get_weather: { input: { location: string }; output: { temperature: number; conditions: string } };
      ping: { input: { message?: string }; output: unknown };
    };
  };
  stocks: {
    tools: {
      quote: { input: { symbol: string }; output: { price: number } };
    };
  };
}
