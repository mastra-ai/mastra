import { Low } from 'lowdb';

import { JSONFile } from 'lowdb/node';

interface Question {
  id: string;
  text: string;
  createdAt: string;
}

interface Answer {
  id: string;
  questionId: string;
  text: string;
  createdAt: string;
}

interface Schema {
  questions: Question[];
  answers: Answer[];
}

const defaultData: Schema = {
  questions: [],
  answers: [],
};

const adapter = new JSONFile<Schema>('db.json');
const db = new Low<Schema>(adapter, defaultData);

export const initDb = async () => {
  await db.read();
  await db.write();
};

export const createQuestion = async (text: string): Promise<Question> => {
  const question: Question = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
  };
  db.data.questions.push(question);
  await db.write();
  return question;
};

export const getAnswer = async (questionId: string): Promise<Answer | undefined> => {
  await db.read();
  return db.data.answers.find(a => a.questionId === questionId);
};

export const createAnswer = async (questionId: string, text: string): Promise<Answer> => {
  const answer: Answer = {
    id: crypto.randomUUID(),
    questionId,
    text,
    createdAt: new Date().toISOString(),
  };
  db.data.answers.push(answer);
  await db.write();
  return answer;
};

export type { Question, Answer };
