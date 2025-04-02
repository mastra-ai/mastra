'use client';

import { useRealtimeSession } from '@/hooks/realtime';
import { useRef, useState } from 'react';
import {
  createExerciseLogTool,
  createTimerTool,
  createWorkoutSummaryTool,
  createWorkoutTool,
  type ExerciseLogInput,
  type TimerInput,
  type WorkoutInput,
  type WorkoutSummaryInput,
} from '../tools';
import { Button } from './Button';
import { Workout } from './Workout';

const instructions = `You are a personal trainer. You will be given information about the user's current workout and you will need to provide feedback on the user's performance.

You will be given a list of exercises and the user's current workout.

You will need to provide feedback on the user's performance and provide encouragement.

You are also in charge of the timer and keeping track of the user's progress.

After the user completes an exercise you will need to ask them to rest and create a timer for the rest time.

At the end of the workout, you will need to provide a summary of the workout and the user's progress.`;

const initialMessage = `Ask the user what they would like to do today.`;

export const OpenAIRealtime = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [timer, setTimer] = useState<TimerInput | null>(null);
  const [workout, setWorkout] = useState<WorkoutInput | null>(null);
  const [exerciseLog, setExerciseLog] = useState<ExerciseLogInput[]>([]);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummaryInput | null>(null);

  const { connectionState, createSession } = useRealtimeSession();

  const handleCreateSession = async () => {
    await createSession({
      instructions,
      initialMessage,
      tools: [
        createTimerTool(({ seconds }, { connection }) => {
          connection.sendResponse(`Timer started.`);
          setTimer({ seconds });

          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            console.log('Timer finished');
            connection.sendResponse(
              `Timer finished. ${seconds} seconds have passed. Inform the user of the next exercise.`,
            );
          }, seconds * 1000);
        }),
        createWorkoutTool(({ name, restTime, exercises }, { connection }) => {
          console.log('Workout created', name, exercises);
          setWorkout({ name, restTime, exercises });
          connection.sendResponse(
            `Workout created. ${name} with ${exercises.length} exercises and a rest time of ${restTime} seconds.`,
          );
        }),
        createExerciseLogTool(({ exercise, sentiment, sets, reps }, { connection }) => {
          console.log('Exercise logged', exercise, sentiment, sets, reps);
          setExerciseLog(log => [...log, { exercise, sentiment, sets, reps }]);
          connection.sendResponse(
            `Exercise logged. ${exercise} with ${sentiment} sentiment, ${sets} sets, ${reps} reps.`,
          );
        }),
        createWorkoutSummaryTool((input, { connection }) => {
          console.log('Workout summary requested');
          setWorkoutSummary({});
          connection.sendResponse(`Workout summary requested. ${JSON.stringify(workoutSummary)}`);
        }),
      ],
    });
  };

  return (
    <>
      {connectionState === 'connected' ? (
        <Workout workout={workout} exerciseLogs={exerciseLog} timer={timer} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <Button onClick={handleCreateSession}>
            {connectionState === 'pending' ? 'Creating Session...' : 'Create Session'}
          </Button>
        </div>
      )}
    </>
  );
};
