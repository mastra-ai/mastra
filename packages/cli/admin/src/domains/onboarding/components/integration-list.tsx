'use client';

import { motion } from 'framer-motion';
import React from 'react';

import { IntegrationPackage } from '@/domains/integrations/types';

import { IntegrationItem } from './integration-item';

interface IntegrationListProps {
  integrations: IntegrationPackage[];
}

export const IntegrationList = ({ integrations }: IntegrationListProps) => {
  return (
    <div className="grid grid-cols-2  gap-2 p-11">
      {integrations.map((integration, index) => {
        return (
          <motion.div
            key={integration.name}
            initial={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 0.1, duration: 0.2 }}
          >
            <IntegrationItem integration={integration} />
          </motion.div>
        );
      })}
    </div>
  );
};
