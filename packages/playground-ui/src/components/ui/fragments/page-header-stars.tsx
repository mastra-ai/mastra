import { cn } from '@/lib/utils';
import { GithubIcon } from '../../../ds/icons';
import { useEffect, useState } from 'react';

export function PageHeaderStars({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [githubStarCount, setGithubStarCount] = useState<number | undefined>();
  const [fetching, setFetching] = useState<boolean>(false);

  useEffect(() => {
    if (!fetching && !githubStarCount) {
      setFetching(true);

      const fetchStars = async () => {
        const stars = await getGitHubStars();
        if (stars) {
          setGithubStarCount(stars);
          setFetching(false);
        }
      };

      fetchStars();
    }
  }, []);

  return githubStarCount && githubStarCount > 0 ? (
    <a
      className={cn(`group/icon flex items-center gap-2 text-muted-foreground mr-4 p-0`, className)}
      style={style}
      href="https://github.com/mastra-ai/mastra"
      target="_blank"
      rel="noopener"
    >
      <GithubIcon className="h-5 w-5" />

      {formatToK(githubStarCount)}
    </a>
  ) : null;
}

const GITHUB_STARS_KEY = 'githubStars';
const GITHUB_STARS_EXPIRY_KEY = 'githubStarsExpiry';

export async function getGitHubStars(): Promise<number> {
  const expiry = localStorage.getItem(GITHUB_STARS_EXPIRY_KEY);
  if (expiry && Number(expiry) > Date.now()) {
    const cachedStars = localStorage.getItem(GITHUB_STARS_KEY);
    if (cachedStars) {
      return Number(cachedStars);
    }
  }

  try {
    const res = await fetch('https://api.github.com/repos/mastra-ai/mastra', {
      cache: 'no-cache',
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      // Set expiry to 1 hour
      localStorage.setItem(GITHUB_STARS_EXPIRY_KEY, (Date.now() + 60 * 60 * 1000).toString());
      return 0;
    }

    const data = await res.json();
    const stars = data.stargazers_count;

    // Cache the stars and set expiry for 6 hours
    localStorage.setItem(GITHUB_STARS_KEY, stars.toString());
    localStorage.setItem(GITHUB_STARS_EXPIRY_KEY, (Date.now() + 6 * 60 * 60 * 1000).toString());

    return stars;
  } catch (err: unknown) {
    console.error(err);
    // Return cached value if available, otherwise 0
    const cachedStars = localStorage.getItem(GITHUB_STARS_KEY);
    return cachedStars ? Number(cachedStars) : 0;
  }
}

function formatToK(number: number) {
  if (number >= 1000) {
    return (number / 1000).toFixed(number % 1000 === 0 ? 0 : 1) + 'k';
  }
  return number.toString();
}
