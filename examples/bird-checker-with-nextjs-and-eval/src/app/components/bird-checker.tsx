"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getImage, ImageQuery } from "@/lib/mastra/actions";
import { cn } from "@/lib/utils";
import { Bird, Camera, Feather, Plane } from "lucide-react";
import Image from "next/image";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BirdCheckerResponse } from "./bird-checker-response";

const tags = [
  { id: "wildlife", label: "Wildlife", icon: <Camera className="w-4 h-4" /> },
  { id: "feathers", label: "Feathers", icon: <Feather className="w-4 h-4" /> },
  { id: "flying", label: "Flying", icon: <Plane className="w-4 h-4" /> },
  { id: "birds", label: "Birds", icon: <Bird className="w-4 h-4" /> },
];

type Image = {
  alt_description: string;
  urls: {
    regular: string;
    raw: string;
  };
  user: {
    first_name: string;
    links: {
      html: string;
    };
  };
};
export type Status = "idle" | "loading" | "success" | "error";

export const BirdChecker = () => {
  const [image, setImage] = useState<Image | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [query, setQuery] = useQueryState("query", {
    defaultValue: "wildlife",
  });

  useEffect(() => {
    const getRandomImage = async () => {
      setStatus("loading");
      console.log("got here");
      const res = await getImage({ query: query as ImageQuery });
      if (!res.ok) {
        setStatus("error");
        toast.error("Failed to fetch image");
        return;
      }

      console.log("after fetch=====", "got here");

      setImage(res.data);

      setStatus("success");
    };
    getRandomImage();
  }, [query]);

  const handleTagClick = (tagId: string) => {
    setQuery(tagId);
  };

  return (
    <div>
      <Card className="w-full relative border-none bg-transparent shadow-2xl rounded pt-8 md:mt-4  mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle>
            <h1 className="font-medium mx-auto text-center font-serif text-5xl">
              Bird Checker
            </h1>
            <p className="md:hidden text-sm text-center font-base font-normal italic font-serif">
              Inspired by{" "}
              <a
                rel="noopener"
                href="https://xkcd.com/1425/"
                target="_blank"
                className="text-[#0057ff] font-medium"
              >
                Randall Munroe
              </a>
            </p>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 md:grid grid-cols-2 md:gap-12 space-y-6">
          <div className="flex md:flex-col flex-col-reverse gap-4">
            <div>
              <div
                className={cn(
                  "relative grow-0 bg-gray-100/50 rounded p-2 border  w-full aspect-square  flex items-center justify-center",
                  status === "loading" ? "animate-pulse" : "",
                )}
              >
                {status === "loading" ? <span>Fetching image...</span> : null}
                {status === "idle" ? null : status === "success" && image ? (
                  <Image
                    src={`${image.urls.regular}`}
                    alt={image.alt_description}
                    width={600}
                    height={300}
                    className="w-full h-full rounded transition-opacity duration-200"
                  />
                ) : null}
              </div>
              <span className="text-xs font-serif italic">
                Credit:{" "}
                <a
                  href="unsplash.com"
                  target="_blank"
                  className="text-blue-600 underline"
                >
                  Unsplah
                </a>
                , Photographer{" "}
                <a
                  href={image?.user.links.html}
                  className="text-blue-600 underline font-medium"
                  target="_blank"
                >
                  {image?.user.first_name}
                </a>
              </span>
            </div>

            <div className="rounded">
              <p className="text-gray-600 hidden md:block text-xs md:text-base">
                Click to regenerate:
              </p>
              <div className=" mt-2 flex md:grid md:grid-cols-2 md:gap-4 gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.id)}
                    disabled={status === "loading"}
                    className={`
                  relative md:p-4 p-2 text-xs md:text-base md:rounded-lg font-medium
                  transition-all duration-200
                  ${
                    query === tag.id
                      ? "bg-[#0057ff]  text-white md:shadow-lg scale-95"
                      : "bg-white scale-95 hover:bg-gray-50 text-gray-700  md:hover:shadow-md hover:scale-100"
                  }
                  border-2 border-gray-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  group flex items-center justify-center gap-2
                  min-h-[34px]
                `}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <BirdCheckerResponse
            query={query}
            status={status}
            imageUrl={image?.urls.regular}
          />
          <span className="sm:hidden bottom-2 right-2 w-fit mx-auto py-1 bg-gray-100 duration-300 ease-out transition-all rounded-full px-2 border-[hsla(256,2%,99%,.08)] justify-center items-center font-medium border text-sm">
            <div className="flex gap-2">
              <a
                rel="noopener"
                href="https://github.com/mastra-ai/mastra/tree/main/examples/bird-checker-with-nextjs-and-eval"
                target="_blank"
                className="uppercase inline-flex items-center h-4 rounded-full text-black px-1.5 leading-tight tracking-widest text-[9px] bg-gray-50 font-semibold"
              >
                see the code
              </a>
              <span className="text-xs text-black font-semibold">
                Built with{" "}
                <a
                  href="https://mastra.ai/"
                  rel="noopener"
                  className="underline"
                  target="_blank"
                >
                  Mastra.ai
                </a>
              </span>
            </div>
          </span>
          <p className="absolute hidden md:block right-2 bottom-2 italic font-serif">
            Inspired by{" "}
            <a
              rel="noopener"
              href="https://xkcd.com/1425/"
              target="_blank"
              className="text-[#0057ff] font-medium"
            >
              Randall Munroe
            </a>
          </p>
        </CardContent>
      </Card>
      <span className="hidden md:block md:fixed bottom-2 right-2 w-fit mx-auto py-1 bg-gray-100 duration-300 ease-out transition-all rounded-full px-2 border-[hsla(256,2%,99%,.08)] justify-center items-center font-medium border text-sm">
        <div className="flex gap-2">
          <a
            rel="noopener"
            href="https://github.com/mastra-ai/mastra/tree/main/examples/bird-checker-with-nextjs-and-eval"
            target="_blank"
            className="uppercase inline-flex items-center h-4 rounded-full text-black px-1.5 leading-tight tracking-widest text-[9px] bg-gray-50 font-semibold"
          >
            see the code
          </a>
          <span className="text-xs text-black font-semibold">
            Built with{" "}
            <a
              rel="noopener"
              href="https://mastra.ai/"
              className="underline"
              target="_blank"
            >
              Mastra.ai
            </a>
          </span>
        </div>
      </span>
    </div>
  );
};
