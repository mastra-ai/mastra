import { Wand2 } from 'lucide-react';
import React from 'react';

export const SkillIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <Wand2 {...(props as React.ComponentProps<typeof Wand2>)} />
);
