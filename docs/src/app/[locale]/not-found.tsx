"use client";
import { T, Var } from "gt-next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image404 from "../../../public/404-image.png";
import "../globals.css";

export default function NotFound() {
  const pathname = usePathname();
  const path = pathname.split("/")[2];
  console.log({ path });

  return (
    <div className="bg-primary relative min-h-screen w-full grid place-items-center text-white">
      <div className="text-center z-20 -mt-60">
        <h2 className="font-serif text-8xl text-[hsl(var(--tag-green))] font-medium">
          404
        </h2>
        <T id="_locale_.notFound.title">
          <p className="font-semibold mt-5 text-[var(--light-color-text-4)] dark:text-[var(--color-el-4)]">
            Sorry, we couldn&apos;t find that page
          </p>
        </T>
        <T id="_locale_.notFound.link">
          <Link
            href={`/${path}`}
            className="font-semibold text-[var(--light-color-text-4)] dark:text-[var(--color-el-4)] mt-2"
          >
            Return to{" "}
            <span className="capitalize underline">
              <Var>{path || "docs"}</Var>
            </span>
          </Link>
        </T>
      </div>
      <Image
        alt=""
        src={Image404}
        className="absolute bottom-0 rotate-180 w-full"
        width={500}
        height={500}
      />
    </div>
  );
}
