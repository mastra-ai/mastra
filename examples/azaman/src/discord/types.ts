import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export type NextFunction<N = unknown> = (nextParams?: N) => void;
export type ApiMiddleware<T extends Promise<unknown>, N = unknown> = (
  request: NextRequest,
  { params }: { params: T },
  next: NextFunction<N>,
) => Promise<NextResponse | void | Response>;

export interface DiscordMessage {
  id: string;
  channel_id: string;
  thread_id?: string;
  guild_id?: string;
  content: string;
  author?: {
    bot?: boolean;
  };
  mentions: Array<{
    id: string;
    username: string;
  }>;
  message_reference?: {
    message_id: string;
    channel_id: string;
    guild_id?: string;
  };
}
