import { ArrowUpRight } from "lucide-react";
import React from "react";

import Image from "next/image";

interface ShowcaseCardProps {
  title: string;
  description: string;
  image: string;
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
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
      title: "NotebookLM-Mastra",
      description:
        "NotebookLM is an AI-powered assistant that creates podcasts from the sources you upload",
      image: "/showcase/notebook-lm.png",
      link: "https://notebooklm-mastra.vercel.app/",
    },
    {
      title: "AI Beats Lab",
      description:
        "The AI Beats Laboratory is an interactive web application that generates musical beats and melodies using AI agents.",
      image: "/showcase/ai-beats-lab.png",
      link: "https://ai-beat-lab.lovable.app/",
    },
    {
      title: "TravelAI",
      description:
        "TravelAI is a travel assistant that helps you plan your next trip.",
      image: "/showcase/travel-ai.png",
      link: "https://mastra-eight.vercel.app/",
    },
    {
      title: "Excalidraw app",
      description:
        "a tool that converts whiteboard images into editable Excalidraw diagrams",
      image: "/showcase/excalidraw-app.png",
      link: "https://excalidraw-app.vercel.app/",
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
