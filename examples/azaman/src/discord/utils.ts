/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";

export async function DiscordRequest(endpoint: string, options: any) {
  const url = 'https://discord.com/api/v10/' + endpoint;

  if (options.body) options.body = JSON.stringify(options.body);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });

  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }

  return res;
}

export async function InstallGlobalCommands(appId: string, commands: unknown) {
  const endpoint = `applications/${appId}/commands`;

  try {
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

type VerifiedResponse = {
  isValid: true;
  body: any;
} | {
  isValid: false;
  response: Response;
};

/**
 * Creates a Next.js middleware function for verifying Discord interactions
 *
 * @param clientPublicKey - The public key from the Discord developer dashboard
 * @returns Object containing verification status and either the parsed body or error response
 */
export async function verifyDiscordRequest(
  req: NextRequest,
  clientPublicKey: string,
): Promise<VerifiedResponse> {
  if (!clientPublicKey) {
    return {
      isValid: false,
      response: new Response('Discord client public key not configured', { status: 500 })
    };
  }

  const timestamp = req.headers.get('X-Signature-Timestamp');
  const signature = req.headers.get('X-Signature-Ed25519');

  if (!timestamp || !signature) {
    return {
      isValid: false,
      response: new Response('Invalid request signature', { status: 401 })
    };
  }

  try {
    const rawBody = await req.text();

    const isValidRequest = await verifyKey(
      rawBody,
      signature,
      timestamp,
      clientPublicKey
    );

    if (!isValidRequest) {
      return {
        isValid: false,
        response: new Response('Invalid request signature', { status: 401 })
      };
    }

    const body = JSON.parse(rawBody);

    // Handle Discord PING
    if (body.type === InteractionType.PING) {
      return {
        isValid: false,
        response: NextResponse.json({ type: InteractionResponseType.PONG })
      };
    }

    return {
      isValid: true,
      body
    };

  } catch (error) {
    console.error('Error processing Discord request:', error);
    return {
      isValid: false,
      response: new Response('Internal server error', { status: 500 })
    };
  }
}
