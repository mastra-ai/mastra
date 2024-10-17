import { motion } from 'framer-motion';
import React from 'react';

interface NumberAnimatorProps {
  value: number;
}

const NumberAnimator = ({ value }: NumberAnimatorProps) => {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {value.toLocaleString()}
    </motion.span>
  );
};

export default NumberAnimator;
