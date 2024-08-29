import React from 'react';
import { FormEvent } from 'react';

export const CreateTweet: React.FC = () => {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };
  return <form onSubmit={handleSubmit}></form>;
};
