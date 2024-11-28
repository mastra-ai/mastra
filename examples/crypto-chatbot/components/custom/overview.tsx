import { motion } from 'framer-motion';
import Link from 'next/link';

import { MessageIcon, VercelIcon } from './icons';

const CryptoChatbotIcon = ({ size = 24 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M8 12h8"></path>
    <path d="M12 8v8"></path>
    <circle cx="12" cy="12" r="6"></circle>
    <path d="M10 9.5L8 8M14 9.5L16 8M10 14.5L8 16M14 14.5L16 16"></path>
  </svg>
);

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <p className="flex flex-row justify-center gap-4 items-center">
          <CryptoChatbotIcon size={48} />
        </p>
        <p>Welcome to an example Crypto Chatbot!</p>
        <p>
          You can ask about current crypto prices and trends in the
          cryptocurrency market.
        </p>
      </div>
    </motion.div>
  );
};
