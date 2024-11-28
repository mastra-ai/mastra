"use server";

import { mastra } from "@/mastra";
import { Image, ImageResponse } from "./system-tools";

export type ImageQuery = "wildlife" | "feathers" | "flying" | "birds";

export type BirdResponse = {
  bird: boolean;
  species: string;
  location: string;
};

export const getImage = async ({
  query,
}: {
  query: ImageQuery;
}): Promise<ImageResponse<Image, string>> => {
  console.log("get image ============", "got here");

  const getRandomImageTool = mastra.getTool("getRandomImageTool");

  const response = await getRandomImageTool.execute({
    query,
  });

  return response;
};

export const promptClaude = async ({
  imageUrl,
}: {
  imageUrl: string;
}): Promise<ImageResponse<BirdResponse, string>> => {
  try {
    const birdAgent = mastra.getAgent("Bird checker");

    console.log("calling bird checker agent");

    const response = await birdAgent.textObject({
      messages: [
        [
          {
            type: "image",
            image: imageUrl,
          },
          {
            type: "text",
            text: "view this image and let me know if it's a bird or not, and the scientific name of the bird without any explanation. Also summarize the location for this picture in one or two short sentences understandable by a high school student",
          },
        ],
      ],
      structuredOutput: {
        bird: {
          type: "boolean",
        },
        species: {
          type: "string",
        },
        location: {
          type: "string",
        },
      },
    });

    const { object } = response;

    console.log("prompt claude response====", JSON.stringify(object, null, 2));

    return { ok: true, data: object as BirdResponse };
  } catch (err) {
    console.error("Error prompting claude:", err);
    return { ok: false, error: "Could not fetch image metadata" };
  }
};
