import { Inngest } from 'inngest';
import { serve } from 'inngest/next';

const APP_ID = 'future';

// TODO: This can come be defined somewhere else in core and imported here
const client = new Inngest({
  id: APP_ID,
});

export default serve({
  client,
  functions: [],
});
