import { InteractionResponseType, InteractionType, MessageComponentTypes } from 'discord-interactions';

import { NextRequest, NextResponse } from 'next/server';

import { getRandomEmoji, verifyDiscordRequest } from '@/discord/utils';
import { loadDocs, mastra } from '@/mastra';

export const POST = async (req: NextRequest) => {
  const result = await verifyDiscordRequest(req, process.env.DISCORD_PUBLIC_KEY!);

  if (!result.isValid) {
    return result.response;
  }
  const { type, data } = result.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }

    // "docs" command
    if (name === 'docs') {
      return NextResponse.json(
        // this is a modal
        {
          type: InteractionResponseType.MODAL,
          data: {
            title: 'Ask a question about mastra',
            custom_id: 'azaman_question_modal',
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.INPUT_TEXT,
                    custom_id: 'azaman_question',
                    label: 'Your Question',
                    style: 2, // paragraph style
                    min_length: 1,
                    max_length: 4000,
                    placeholder: 'How do I create a workflow?',
                    required: true,
                  },
                ],
              },
            ],
          },
        },
      );
    }
  }

  /**
   * Handle modal submissions
   */
  if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = data;

    if (custom_id === 'azaman_question_modal') {
      // First, acknowledge the interaction with a deferred response
      await fetch(`https://discord.com/api/v10/interactions/${result.body.id}/${result.body.token}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        }),
      });

      await loadDocs();

      // Get the user's question from the modal
      const question = components[0].components[0].value;

      try {
        const agent = mastra.getAgent('generateAnswerAgent');
        const completion = await agent.generate(question);

        console.log('completion', completion);

        // Send followup message using webhook
        const followupResponse = await fetch(
          `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${result.body.token}/messages/@original`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: completion.text,
            }),
          },
        );

        if (!followupResponse.ok) {
          console.error('Failed to send followup:', await followupResponse.text());
          throw new Error('Failed to send followup message');
        }

        return new Response(null, { status: 200 });
      } catch (error) {
        console.error('Error querying documentation:', error);

        // Send error message as followup
        await fetch(
          `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${result.body.token}/messages/@original`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content:
                "I'm sorry, I encountered an error while trying to answer your question. Please try again later.",
            }),
          },
        );

        return new Response(null, { status: 200 });
      }
    }
  }

  // Return a default response for unhandled cases
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Unknown command' },
  });
};
