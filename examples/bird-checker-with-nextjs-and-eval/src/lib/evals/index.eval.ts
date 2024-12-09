import { Eval } from "braintrust";
import { IMAGES } from "./data";
import { BirdResponse, promptClaude } from "../mastra/actions";

const containsScorer = ({
  output,
  expected,
}: {
  output: BirdResponse;
  expected: Omit<BirdResponse, "location">;
}) => {
  const birdDataCorrect = output?.bird === expected?.bird;

  const speciesDataCorrect = output?.species
    ?.toLocaleLowerCase()
    ?.includes(expected?.species?.toLocaleLowerCase());

  return {
    name: "containsScorer",
    score: birdDataCorrect && speciesDataCorrect ? 1 : 0,
  };
};

Eval("Is a bird", {
  data: () => {
    return [
      {
        input: IMAGES.isBird.image,
        expected: IMAGES.isBird,
      },
      {
        input: IMAGES.notBird.image,
        expected: IMAGES.notBird,
      },
    ];
  },
  task: async (input) => {
    const claudeResponse = await promptClaude({ imageUrl: input });
    if (!claudeResponse.ok) {
      return { bird: false, location: "", species: "" };
    }

    return claudeResponse.data;
  },
  scores: [containsScorer],
});
