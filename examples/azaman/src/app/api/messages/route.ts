import { NextRequest } from 'next/server';
import { verifyDiscordRequest } from '@/discord/utils';
import { handleMessage } from '@/discord/message-handler';

export const POST = async (req: NextRequest) => {
  // Verify the request is from Discord
  const result = await verifyDiscordRequest(req, process.env.DISCORD_PUBLIC_KEY!);
  if (!result.isValid) {
    return result.response;
  }

  console.log('result', result);

  // Handle the message
  await handleMessage(result.body);

  // Return a 200 status to acknowledge receipt
  return new Response(null, { status: 200 });
};
