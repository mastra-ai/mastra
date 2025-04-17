import { ArrowUpRight } from "lucide-react";
import React from "react";

import Image from "next/image";
import { Var, T } from "gt-next/client";

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
  <div className="group showcase-item rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden transition-all">
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
      title: "Olive",
      description:
        "Generate powerful tools and dashboards connected to your data sources in minutes.",
      image: "/showcase/optimized/from-olive.png",
      link: "https://fromolive.com/",
    },
    {
      title: "Artifact",
      description:
        "Artifact is an electrical system design tool that lets you design at any level of fidelity - from concept to connecto",
      image: "/showcase/optimized/artifact-engineer.png",
      link: "https://www.artifact.engineer/",
    },
    {
      title: "Vetnio",
      description: "Automatic Medical Notes For Veterinary Professionals",
      image: "/showcase/optimized/vetnio.png",
      link: "https://vetnio.com/home/en",
    },
    {
      title: "Dalus",
      description:
        "AI-Powered Systems Engineering for Mission-Critical Hardware",
      image: "/showcase/optimized/dalus-io.png",
      link: "https://www.dalus.io/",
    },
    {
      title: "Demeter",
      description: "Instant portfolio insights across all your investments",
      image: "/showcase/optimized/demeter.png",
      link: "https://www.joindemeter.com/",
    },

    {
      title: "NotebookLM-Mastra",
      description:
        "NotebookLM is an AI-powered assistant that creates podcasts from the sources you upload",
      image: "/showcase/optimized/notebook-lm.png",
      link: "https://notebooklm-mastra.vercel.app/",
    },
    {
      title: "Repo Base",
      description: "Chat with any GitHub repository. Understand code faster.",
      image: "/showcase/optimized/repo-base.png",
      link: "https://repo-base.vercel.app/",
    },
    {
      title: "AI Beats Lab",
      description:
        "The AI Beats Laboratory is an interactive web application that generates musical beats and melodies using AI agents.",
      image: "/showcase/optimized/ai-beats-lab.png",
      link: "https://ai-beat-lab.lovable.app/",
    },
    {
      title: "TravelAI",
      description:
        "TravelAI is a travel assistant that helps you plan your next trip.",
      image: "/showcase/optimized/travel-ai.png",
      link: "https://mastra-eight.vercel.app/",
    },
    {
      title: "Excalidraw app",
      description:
        "A tool that converts whiteboard images into editable Excalidraw diagrams",
      image: "/showcase/optimized/excalidraw-app.png",
      link: "https://image2excalidraw.netlify.app/",
    },
    {
      title: "Ecommerce RAG",
      description: "A RAG application for an ecommerce website",
      image: "/showcase/optimized/ecommerce-rag.jpg",
      link: "https://nextjs-commerce-nu-eight-83.vercel.app/",
    },
    {
      title: "Text-to-SQL",
      description: "Generate SQL queries from natural language",
      image: "/showcase/optimized/text-to-sql.png",
      link: "https://mastra-text-to-sql.vercel.app/",
    },
  ];

  return (
    <T id="components.showcase_grid.0">
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
          <Var>
            {showcaseItems.map((item) => (
              <ShowcaseCard key={item.title} {...item} />
            ))}
          </Var>
        </div>
      </div>
    </T>
  );
};
