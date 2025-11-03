import React from "react";
import styles from "./ShowcaseGrid.module.css";
import { msg, useMessages, T } from "gt-react";

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
}: ShowcaseCardProps) => {
  const m = useMessages();
  return (
    <div className={styles.showcaseItem}>
      <a
        href={link}
        className={styles.showcaseLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className={styles.imageContainer}>
          <img
            src={`/img/showcase/optimized/${image}`}
            alt={title}
            className={styles.image}
          />
        </div>
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>{title}</h3>
            <svg
              className={styles.icon}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </div>
          {description && (
            <p className={styles.description}>{m(description)}</p>
          )}
        </div>
      </a>
    </div>
  );
};

const showcaseItems: ShowcaseCardProps[] = [
  {
    title: "Olive",
    description: msg(
      "Generate powerful tools and dashboards connected to your data sources in minutes",
    ),
    image: "from-olive.png",
    link: "https://fromolive.com/",
  },
  {
    title: "Artifact",
    description: msg(
      "Design tool that lets you design at any level of fidelity - from concept to connector",
    ),
    image: "artifact-engineer.png",
    link: "https://www.artifact.engineer/",
  },
  {
    title: "Vetnio",
    description: msg("Automatic Medical Notes For Veterinary Professionals"),
    image: "vetnio.png",
    link: "https://vetnio.com/home/en",
  },
  {
    title: "ChatHub",
    description: msg("Unlock the Power of Multiple AIs"),
    image: "chathub.png",
    link: "https://chathub.gg",
  },
  {
    title: "Dalus",
    description: msg(
      "AI-Powered Systems Engineering for Mission-Critical Hardware",
    ),
    image: "dalus-io.webp",
    link: "https://www.dalus.io/",
  },
  {
    title: "Demeter",
    description: msg("Instant portfolio insights across all your investments"),
    image: "demeter.png",
    link: "https://www.joindemeter.com/",
  },
  {
    title: "NotebookLM-Mastra",
    description: msg(
      "AI-powered assistant that creates podcasts from the sources you upload",
    ),
    image: "notebook-lm.png",
    link: "https://notebooklm-mastra.vercel.app/",
  },
  {
    title: "Repo Base",
    description: msg("Chat with any GitHub repository. Understand code faster"),
    image: "repo-base.png",
    link: "https://repo-base.vercel.app/",
  },
  {
    title: "AI Beats Lab",
    description: msg("Generate musical beats and melodies using AI agents"),
    image: "ai-beats-lab.png",
    link: "https://ai-beat-lab.lovable.app/",
  },
  {
    title: "Excalidraw app",
    description: msg(
      "A tool that converts whiteboard images into editable Excalidraw diagrams",
    ),
    image: "excalidraw-app.png",
    link: "https://image2excalidraw.netlify.app/",
  },
  {
    title: "Ecommerce RAG",
    description: msg("A RAG application for an ecommerce website"),
    image: "ecommerce-rag.jpg",
    link: "https://nextjs-commerce-nu-eight-83.vercel.app/",
  },
  {
    title: "Text-to-SQL",
    description: msg("Generate SQL queries from natural language"),
    image: "text-to-sql.png",
    link: "https://mastra-text-to-sql.vercel.app/",
  },
];

export const ShowcaseGrid = () => {
  return (
    <div className="showcase__grid max-w-[64rem] mx-auto py-12 px-12">
      <T>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-(--mastra-text-primary) dark:text-white">
            Showcase
          </h1>
          <p className="text-lg text-(--mastra-text-tertiary)">
            Check out these applications built with Mastra.
          </p>
        </div>
      </T>
      <div className={styles.showcaseGrid}>
        {showcaseItems.map((item) => (
          <ShowcaseCard key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
};
