"use client"
import Link from "next/link";
import "../globals.css"
import { useParams, usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname()
  const params = useParams()
  const path = params?.mdxPath?.[0] || pathname.split('/')[1]

  return (
    <div className="bg-[var(--primary-bg)] min-h-screen w-full grid place-items-center text-white">
      <div className="text-center">
          <h2 className="font-serif text-7xl font-medium">404</h2>
          <p>We could not find the requested documentation</p>
          <Link href="/docs">Return to <span className="text-[hsl(var(--tag-green))]  capitalize underline">{path || 'docs'}</span></Link>
      </div>
    </div>
  );
}
