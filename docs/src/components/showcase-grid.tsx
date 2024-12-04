import { ArrowUpRight } from "lucide-react";
import React from "react";

import Image, { StaticImageData } from "next/image";

import audiofeedImage from "../pages/public/showcase/audio-feed.png";
import birdCheckerImage from "../pages/public/showcase/bird-checker.png";
import cryptoChatbotImage from "../pages/public/showcase/crypto-chatbot.png";
import openApiSpecWriterImage from "../pages/public/showcase/open-api-spec-writer.png";

interface ShowcaseCardProps {
  title: string;
  description: string;
  image: StaticImageData;
  link: string;
}

const ShowcaseCard = ({
  title,
  description,
  image,
  link,
}: ShowcaseCardProps) => (
  <div className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden transition-all">
    <a href={link} className="block" target="_blank" rel="noopener noreferrer">
      <div className="aspect-video relative overflow-hidden bg-zinc-900">
        <Image
          src={image}
          alt={title}
          className="object-cover w-full h-full transition-transform group-hover:scale-105"
          layout="fill"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600">
            {title}
          </h3>
          <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all text-zinc-600 dark:text-zinc-400" />
        </div>
        {description && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
    </a>
  </div>
);

export const ShowcaseGrid = () => {
  const showcaseItems: ShowcaseCardProps[] = [
    {
      title: "Audiofeed",
      description: "Audiofeed repurposes your content into audio and video.",
      image: audiofeedImage,
      link: "https://audiofeed.ai",
    },
    {
      title: "Bird Checker",
      description: "Bird Checker is a bird identification app.",
      image: birdCheckerImage,
      link: "https://bird-checker.vercel.app",
    },
    {
      title: "OpenAPI Spec Writer",
      description: "Generate an open api spec from your documentation url.",
      image: openApiSpecWriterImage,
      link: "https://openapi-spec-writer.vercel.app",
    },
    {
      title: "Crypto Chatbot",
      description:
        "You can ask about current crypto prices and trends in the cryptocurrency market.",
      image: cryptoChatbotImage,
      link: "https://crypto-chatbot-xi.vercel.app/",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl  px-4  py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-zinc-900 dark:text-zinc-100">
          Showcase
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Check out these applications built with Mastra.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {showcaseItems.map((item) => (
          <ShowcaseCard key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
};
