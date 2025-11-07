export const GithubStarCount = () => {
  return (
    <a
      href="https://github.com/mastra-ai/mastra"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium hover:text-black  cursor-pointer w-fit text-(--mastra-text-quaternary) dark:text-white  rounded-md  transition-colors hover:opacity-100 flex items-center gap-2 justify-start px-2.5 py-2 h-8.5 text-sm"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        id="github"
        viewBox="0 0 24 24"
        className="size-5 dark:text-white"
      >
        <polygon
          fill="currentColor"
          points="23 9 23 15 22 15 22 17 21 17 21 19 20 19 20 20 19 20 19 21 18 21 18 22 16 22 16 23 15 23 15 18 14 18 14 17 15 17 15 16 17 16 17 15 18 15 18 14 19 14 19 9 18 9 18 6 16 6 16 7 15 7 15 8 14 8 14 7 10 7 10 8 9 8 9 7 8 7 8 6 6 6 6 9 5 9 5 14 6 14 6 15 7 15 7 16 9 16 9 18 7 18 7 17 6 17 6 16 4 16 4 17 5 17 5 19 6 19 6 20 9 20 9 23 8 23 8 22 6 22 6 21 5 21 5 20 4 20 4 19 3 19 3 17 2 17 2 15 1 15 1 9 2 9 2 7 3 7 3 5 4 5 4 4 5 4 5 3 7 3 7 2 9 2 9 1 15 1 15 2 17 2 17 3 19 3 19 4 20 4 20 5 21 5 21 7 22 7 22 9 23 9"
        />
      </svg>
    </a>
  );
};
