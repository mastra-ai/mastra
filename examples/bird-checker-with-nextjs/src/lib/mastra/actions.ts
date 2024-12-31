"use server";

import { mastra } from "@/mastra";
import { getRandomImage, Image, ImageResponse } from "./system-tools";
import { z } from "zod";

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
  const response = await getRandomImage({ query });

  return response as ImageResponse<Image, string>;
};

export const promptClaude = async ({
  imageUrl,
}: {
  imageUrl: string;
}): Promise<ImageResponse<BirdResponse, string>> => {
  try {
    const birdAgent = mastra.getAgent("birdAgent");

    console.log("calling bird checker agent");

    const response = await birdAgent.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageUrl,
            },
            {
              type: "text",
              text: "view this image and let me know if it's a bird or not, and the scientific name of the bird without any explanation. Also summarize the location for this picture in one or two short sentences understandable by a high school student",
            },
          ],
        },
      ],
      {
        output: z.object({
          bird: z.boolean(),
          species: z.string(),
          location: z.string(),
        }),
      },
    );

    const { object } = response;

    console.log("prompt claude response====", JSON.stringify(object, null, 2));

    return { ok: true, data: object as BirdResponse };
  } catch (err) {
    console.error("Error prompting claude:", err);
    return { ok: false, error: "Could not fetch image metadata" };
  }
};
