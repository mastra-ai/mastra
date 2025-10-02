import { HTTPException } from 'hono/http-exception';

// Validation helper
export function validateBody(body: Record<string, unknown>) {
  const errorResponse = Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      acc[key] = `${key} is required`;
    }
    return acc;
  }, {});

  if (Object.keys(errorResponse).length > 0) {
    throw new HTTPException(400, { message: JSON.stringify(errorResponse) });
  }
}

export const AllowedProviderKeys = {
  openai: 'OPENAI_API_KEY',
  xai: 'XAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
};
