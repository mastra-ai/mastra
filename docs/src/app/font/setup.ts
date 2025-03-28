import { Inter, Geist_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--geist-mono" });

export const fonts = {
  geistMono,
  inter,
};
