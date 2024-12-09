"use client";

import { promptClaude } from "@/lib/mastra/actions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Status } from "./bird-checker";
import { Skeleton } from "@/components/ui/skeleton";
import { Bird, Check, MapPin } from "lucide-react";

export const BirdCheckerResponse = ({
  imageUrl,
  status,
  query,
}: {
  imageUrl?: string;
  status: Status;
  query: string;
}) => {
  const [metadata, setMedata] = useState<{
    bird: string;
    location: string;
    species: string;
  } | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<Status>("idle");

  useEffect(() => {
    setMedata(null);
    setMetadataStatus("loading");
  }, [query]);

  useEffect(() => {
    const getRandomImage = async () => {
      if (!imageUrl) return;

      setMetadataStatus("loading");
      const res = await promptClaude({ imageUrl });

      if (!res.ok) {
        toast.error("Failed to fetch image metadata");
        setMetadataStatus("error");
        return;
      }
      console.log("res===", res.data);
      setMetadataStatus("success");
      const object = { ...res.data, bird: res.data.bird ? "yes" : "no" };

      setMedata(object);
    };

    getRandomImage();
  }, [imageUrl]);

  return (
    <div className="flex !mt-0 flex-col gap-4">
      {status === "loading" || metadataStatus === "loading" ? (
        <p className=" animate-pu">
          thinking{" "}
          <span className="animate-ellipsis">
            <span className="inline-block animate-bounce [animation-delay:-0.3s]">
              .
            </span>
            <span className="inline-block animate-bounce [animation-delay:-0.2s]">
              .
            </span>
            <span className="inline-block animate-bounce [animation-delay:-0.1s]">
              .
            </span>
          </span>
        </p>
      ) : (
        ""
      )}

      <div className="flex flex-col border">
        <div className="flex border-b flex-col p-2 gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Check className="h-4 w-4" />
            <span className="font-serif text-sm">Is it a bird?</span>
          </div>

          {status === "loading" ? (
            <Skeleton className="h-4 w-[200px]" />
          ) : (
            <>
              {metadataStatus === "loading" ? (
                <Skeleton className="h-4 w-[200px]" />
              ) : null}
              {metadata?.bird ? (
                <span className="py-1 px-5 font-serif font-medium bg-blue-100 w-fit  rounded">
                  {metadata.bird}
                </span>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col  border-b p-3 gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bird className="h-4 w-4" />
            <span className="font-serif text-sm">Species</span>
          </div>

          {status === "loading" ? (
            <Skeleton className="h-4 w-[200px]" />
          ) : (
            <>
              {metadataStatus === "loading" ? (
                <Skeleton className="h-4 w-[200px]" />
              ) : null}
              {metadata?.species ? (
                <span className="p-3 font-serif font-medium bg-blue-100 w-fit  rounded">
                  {metadata.species}
                </span>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-col  p-3 gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="font-serif text-sm">Location</span>
          </div>

          {status === "loading" ? (
            <Skeleton className="h-4 w-[200px]" />
          ) : (
            <>
              {metadataStatus === "loading" ? (
                <Skeleton className="h-4 w-[200px]" />
              ) : null}
              {metadata?.location ? (
                <span className="p-3 font-serif font-medium bg-blue-100 w-fit rounded">
                  {metadata.location}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
