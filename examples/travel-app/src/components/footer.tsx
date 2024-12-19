import { MastraLogo } from './ui/icons';

export default function Footer() {
  return (
    <footer className="bg-[var(--brut-bg)] border-t-4 border-black font-mono">
      <div className="container mx-auto px-4 py-6">
        <a
          href="https://mastra.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block hover:opacity-80 transition-opacity"
        >
          <MastraLogo className="h-9 text-gray-900" />
        </a>
      </div>
    </footer>
  );
}
