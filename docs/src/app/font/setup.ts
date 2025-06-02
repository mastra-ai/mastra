import { Inter, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

const inter = Inter({ subsets: ["latin"], variable: "--inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--geist-mono" });

const tasa = localFont({
  src: "./TASAExplorerVF.woff2",
  display: "swap",
  variable: "--tasa",
});

export const fonts = {
  geistMono,
  inter,
  tasa,
};
