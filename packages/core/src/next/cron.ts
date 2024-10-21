import { NextRequest, NextResponse } from 'next/server';
import { Mastra } from '../framework';
import { parseQueryParams } from './utils';
import { cronQueryParams } from '../schemas';
import { z } from 'zod';

export const makeCron = (framework: Mastra) => {
  return (req: NextRequest) => {
    const params = parseQueryParams<z.infer<typeof cronQueryParams>>(
      req,
      cronQueryParams
    );
    const { data, error } = params;
    if (error) {
      return NextResponse.json({ error, status: 400 });
    }

    const { event, integrationName } = data;

    if (!event) {
      return NextResponse.json({
        error: 'Event is required for mastra cron',
        status: 400,
      });
    }

    const decodedEvent = decodeURI(event);
    let decodedData = {};

    if (data?.data) {
      decodedData = JSON.parse(
        Buffer.from(data.data, 'base64').toString()
      ) as Record<string, any>;
    }

    void framework.triggerEvent({
      key: decodedEvent,
      data: decodedData,
      integrationName,
      user: {
        connectionId: 'SYSTEM',
      },
    });

    return NextResponse.json({ message: `Cron Triggered event ${event}` });
  };
};
