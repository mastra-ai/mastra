import { Navbar } from "nextra-theme-docs";
import { logo } from "@/components/logo";
import { GithubStarCount } from "@/components/github-star-count";

export const Nav = () => {
  return (
    <Navbar
      logo={logo}
      logoLink={process.env.NEXT_PUBLIC_APP_URL}
      projectIcon={<GithubStarCount />}
      projectLink="https://github.com/mastra-ai/mastra"
      chatIcon={null}
      chatLink={""}
    />
  );
};
