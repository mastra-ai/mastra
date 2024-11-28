import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type BirdObj = {
  bird: string;
  location: string;
  species: string;
};

export function getObjectFromString(text: string): BirdObj {
  // First approach: using match()
  const regex =
    /(?<=bird:).*?(?=,|\n)|(?<=location:).*?(?=,|\n)|(?<=species:).*(?=\n|})/g;
  const matches = text.match(regex);

  if (!matches) {
    return {
      bird: "no",
      location: text,
      species: "",
    };
  }

  const [bird, location, species] = matches;
  console.log("Bird:", bird);
  console.log("Location:", location);
  console.log("Species:", species);

  return {
    bird: bird?.trim(),
    location: location?.trim(),
    species: species?.split("}")?.join("")?.trim(),
  };
}
