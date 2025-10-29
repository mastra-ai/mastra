import React from "react";

interface ShowcaseCardProps {
  title: string;
  description: string;
  image: string;
  link: string;
}

const ArrowUpRight = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

const ShowcaseCard = ({
  title,
  description,
  image,
  link,
}: ShowcaseCardProps) => (
  <div className="group showcase-item rounded-lg border-[0.5px] border-(--border) dark:border-[#343434] bg-white dark:bg-[#050505] overflow-hidden transition-all hover:opacity-90">
    <a
      style={{
        textDecoration: "none",
      }}
      href={link}
      className="block showcase-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="aspect-video relative overflow-hidden bg-[#050505]">
        <img
          src={`/img/showcase/optimized/${image}`}
          alt={title}
          className="object-cover w-full h-full transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--mastra-text-primary)] group-hover:text-[var(--mastra-green-accent-2)]">
            {title}
          </h3>
          <div className="opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all text-[var(--mastra-text-tertiary)]">
            <ArrowUpRight />
          </div>
        </div>
        {description && (
          <p
            className="mt-2 text-sm text-[var(--mastra-text-tertiary)]"
            style={{ textDecoration: "none" }}
          >
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
        "Generate powerful tools and dashboards connected to your data sources in minutes",
      image: "from-olive.png",
      link: "https://fromolive.com/",
    },
    {
      title: "Artifact",
      description:
        "Design tool that lets you design at any level of fidelity - from concept to connector",
      image: "artifact-engineer.png",
      link: "https://www.artifact.engineer/",
    },
    {
      title: "Vetnio",
      description: "Automatic Medical Notes For Veterinary Professionals",
      image: "vetnio.png",
      link: "https://vetnio.com/home/en",
    },
    {
      title: "ChatHub",
      description: "Unlock the Power of Multiple AIs",
      image: "chathub.png",
      link: "https://chathub.gg",
    },
    {
      title: "Dalus",
      description:
        "AI-Powered Systems Engineering for Mission-Critical Hardware",
      image: "dalus-io.webp",
      link: "https://www.dalus.io/",
    },
    {
      title: "Demeter",
      description: "Instant portfolio insights across all your investments",
      image: "demeter.png",
      link: "https://www.joindemeter.com/",
    },

    {
      title: "NotebookLM-Mastra",
      description:
        "AI-powered assistant that creates podcasts from the sources you upload",
      image: "notebook-lm.png",
      link: "https://notebooklm-mastra.vercel.app/",
    },
    {
      title: "Repo Base",
      description: "Chat with any GitHub repository. Understand code faster",
      image: "repo-base.png",
      link: "https://repo-base.vercel.app/",
    },
    {
      title: "AI Beats Lab",
      description: "Generate musical beats and melodies using AI agents",
      image: "ai-beats-lab.png",
      link: "https://ai-beat-lab.lovable.app/",
    },
    {
      title: "Excalidraw app",
      description:
        "A tool that converts whiteboard images into editable Excalidraw diagrams",
      image: "excalidraw-app.png",
      link: "https://image2excalidraw.netlify.app/",
    },
    {
      title: "Ecommerce RAG",
      description: "A RAG application for an ecommerce website",
      image: "ecommerce-rag.jpg",
      link: "https://nextjs-commerce-nu-eight-83.vercel.app/",
    },
    {
      title: "Text-to-SQL",
      description: "Generate SQL queries from natural language",
      image: "text-to-sql.png",
      link: "https://mastra-text-to-sql.vercel.app/",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-[var(--mastra-text-primary)]">
          Showcase
        </h1>
        <p className="text-lg text-[var(--mastra-text-tertiary)]">
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
