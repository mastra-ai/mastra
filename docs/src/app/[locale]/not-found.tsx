"use client"
import Link from "next/link";
import "../globals.css"
import { useParams, usePathname } from "next/navigation";
import Image from "next/image";
import Image404 from "../../../public/404-image.png"

export default function NotFound() {
  const pathname = usePathname()
  const params = useParams()
  const path = params?.mdxPath?.[0] || pathname.split('/')[1]

  return (
    <div className="bg-[var(--primary-bg)] relative min-h-screen w-full grid place-items-center text-white">
      <div className="text-center z-20 -mt-60">
        <h2 className="font-serif text-8xl text-[hsl(var(--tag-green))] font-medium">
          404
        </h2>
        <p className="font-semibold mt-5 text-[var(--color-el-4)]">
          Sorry, we couldn&apos;t find that page
        </p>
        <Link
          href="/docs"
          className="font-semibold text-[var(--color-el-4)] mt-2"
        >
          Return to{" "}
          <span className="capitalize underline">{path || "docs"}</span>
        </Link>
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
