"use client";
import React from "react";
const localStorageKey = `MASTRA_AI_STAR_COUNT`;

function formatToK(number: number) {
  if (number >= 1000) {
    return (number / 1000).toFixed(number % 1000 === 0 ? 0 : 1) + "k";
  }
  return number.toString();
}

export async function getGitHubStars(): Promise<number> {
  try {
    const res = await fetch("https://api.github.com/repos/mastra-ai/mastra", {
      cache: "no-cache",
    });

    if (!res.ok) {
      throw new Error("Failed to fetch stars");
    }

    const data = await res.json();
    return data.stargazers_count;
  } catch (err: unknown) {
    console.error(err);
    return 0;
  }
}
export const GithubStarCount = () => {
  const [starCount, setStarCount] = React.useState(0);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const fetchStars = async () => {
      const stars = await getGitHubStars();
      if (stars) {
        setStarCount(stars);
        localStorage.setItem(localStorageKey, JSON.stringify(stars));
      } else {
        setStarCount(0);
      }
    };

    fetchStars();
  }, []);

  React.useEffect(() => {
    if (starCount > 0) {
      localStorage.setItem(localStorageKey, JSON.stringify(starCount));
    } else {
      const starCountFromLS = localStorage.getItem(localStorageKey);
      if (starCountFromLS) {
        setStarCount(JSON.parse(starCountFromLS));
      }
    }
  }, [starCount]);

  return (
    <>
      {isClient ? (
        <ul className="-mr-8">
          <li>
            <a
              target="_blank"
              href="https://github.com/mastra-ai/mastra"
              className="font-medium w-fit rounded-md opacity-90 transition-colors hover:opacity-100 flex items-center gap-2 justify-start pl-[7px] pr-2.5 py-2 h-[2.125rem] dark:text-white text-sm"
            >
              <svg
                width="37"
                height="37"
                viewBox="0 0 37 37"
                fill="none"
                className="size-5 dark:text-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M18.6239 0.969559C8.78382 0.969559 0.829102 9.11871 0.829102 19.2003C0.829102 27.2591 5.92596 34.0807 12.9967 36.4951C13.8807 36.6766 14.2045 36.1028 14.2045 35.6201C14.2045 35.1975 14.1754 33.7488 14.1754 32.2393C9.22528 33.3261 8.19447 30.0661 8.19447 30.0661C7.39896 27.9533 6.22027 27.4102 6.22027 27.4102C4.60012 26.2934 6.33829 26.2934 6.33829 26.2934C8.13547 26.4142 9.07849 28.1648 9.07849 28.1648C10.6691 30.9414 13.2323 30.1569 14.2635 29.6738C14.4107 28.4967 14.8824 27.6817 15.3832 27.2291C11.4351 26.8065 7.28131 25.237 7.28131 18.2343C7.28131 16.2422 7.98795 14.6124 9.10763 13.3448C8.93097 12.8921 8.31212 11.0204 9.28465 8.51531C9.28465 8.51531 10.7872 8.03228 14.175 10.3866C15.6254 9.98759 17.1213 9.78458 18.6239 9.78287C20.1264 9.78287 21.658 9.99438 23.0724 10.3866C26.4606 8.03228 27.9631 8.51531 27.9631 8.51531C28.9356 11.0204 28.3164 12.8921 28.1397 13.3448C29.2889 14.6124 29.9664 16.2422 29.9664 18.2343C29.9664 25.237 25.8126 26.7761 21.835 27.2291C22.4834 27.8025 23.0429 28.8889 23.0429 30.6095C23.0429 33.0543 23.0137 35.0164 23.0137 35.6198C23.0137 36.1028 23.3379 36.6766 24.2216 36.4954C31.2923 34.0803 36.3891 27.2591 36.3891 19.2003C36.4183 9.11871 28.4344 0.969559 18.6239 0.969559Z"
                  fill="currentColor"
                />
              </svg>

              <div className="flex gap-1 items-center">
                <span>{formatToK(starCount)}</span>
                <svg
                  className="size-4 dark:text-[#E6E6E6] text-black"
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.9521 4.33076C11.897 4.18422 11.7982 4.05781 11.6688 3.9684C11.5394 3.87899 11.3856 3.83084 11.2279 3.83037L8.09289 3.83037C8.03957 3.83041 7.98746 3.81402 7.94391 3.78347C7.90037 3.75292 7.86746 3.70972 7.8498 3.65983L6.72441 0.497666C6.66928 0.351514 6.57045 0.22554 6.44113 0.136594C6.3118 0.0476572 6.15817 0 6.00078 0C5.84338 0 5.68975 0.0476572 5.56043 0.136594C5.43111 0.22554 5.33227 0.351514 5.27715 0.497666L5.27457 0.505834L4.15179 3.65983C4.13411 3.70964 4.10128 3.75278 4.05784 3.78332C4.01439 3.81386 3.96247 3.8303 3.90921 3.83037L0.773143 3.83037C0.614417 3.83025 0.459497 3.8786 0.329477 3.96885C0.199449 4.0591 0.10062 4.18687 0.046423 4.33478C-0.00776818 4.48268 -0.0146947 4.64354 0.0265887 4.79548C0.0678773 4.94743 0.155366 5.08307 0.277157 5.18398L2.94711 7.37957C2.98706 7.41243 3.01605 7.45648 3.03029 7.50596C3.04454 7.55543 3.04337 7.60802 3.02694 7.65683L1.90519 10.9916C1.85335 11.1458 1.85233 11.3123 1.90227 11.4671C1.95221 11.6219 2.05053 11.7569 2.18301 11.8527C2.31548 11.9484 2.47523 12 2.63917 11.9997C2.80311 11.9995 2.96273 11.9475 3.09494 11.8515L5.84833 9.84985C5.89248 9.8178 5.94579 9.80048 6.00052 9.80048C6.05525 9.80048 6.10856 9.8178 6.15272 9.84985L8.90511 11.8509C9.0372 11.9474 9.19689 11.9996 9.36103 12C9.52509 12.0004 9.68503 11.9491 9.81771 11.8533C9.95031 11.7576 10.0488 11.6224 10.0989 11.4675C10.1488 11.3126 10.1478 11.1459 10.0959 10.9916L8.97411 7.65479C8.95766 7.60597 8.95654 7.55339 8.97077 7.50391C8.985 7.45444 9.01397 7.41038 9.05391 7.37753L11.7291 5.17887C11.8493 5.07711 11.9351 4.94123 11.975 4.78957C12.0149 4.6379 12.0069 4.47776 11.9521 4.33076Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </a>
          </li>
        </ul>
      ) : null}
    </>
  );
};
