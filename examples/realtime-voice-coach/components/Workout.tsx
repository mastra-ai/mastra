'use client';

import { useState, useEffect } from 'react';
import { Timer } from './Timer';
import { ExerciseLog } from './ExerciseLog';
import { WorkoutInput, ExerciseLogInput } from '../tools';

interface WorkoutProps {
  workout: WorkoutInput | null;
  exerciseLogs: ExerciseLogInput[];
  timer: { seconds: number } | null;
}

export function Workout({ workout, exerciseLogs, timer }: WorkoutProps) {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isWorkoutComplete, setIsWorkoutComplete] = useState(false);

  useEffect(() => {
    if (workout && exerciseLogs.length >= workout.exercises.length) {
      setIsWorkoutComplete(true);
    }
  }, [workout, exerciseLogs]);

  if (!workout) {
    return (
      <div className="p-6 bg-gray-100 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">No Workout Started</h2>
        <p>Ask your AI coach to create a workout for you.</p>
      </div>
    );
  }

  const currentExercise = workout.exercises[currentExerciseIndex];

  const handleNextExercise = () => {
    if (currentExerciseIndex < workout.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
    } else {
      setIsWorkoutComplete(true);
    }
  };

  return (
    <div className="p-6 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">{workout.name}</h2>

      {timer && <Timer seconds={timer.seconds} />}

      {!isWorkoutComplete ? (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Current Exercise</h3>
          <div className="bg-white p-4 rounded-md shadow-sm">
            <p className="text-lg font-medium">{currentExercise.name}</p>
            <p className="text-gray-600">
              {currentExercise.sets} sets × {currentExercise.reps} reps
            </p>
            <button
              onClick={handleNextExercise}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Next Exercise
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-green-100 rounded-md">
          <h3 className="text-xl font-semibold text-green-800">Workout Complete!</h3>
          <p className="text-green-700">Great job finishing your workout.</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Workout Plan</h3>
        <div className="space-y-2">
          {workout.exercises.map((exercise, index) => (
            <div
              key={index}
              className={`p-3 rounded-md ${
                index === currentExerciseIndex
                  ? 'bg-blue-100 border-l-4 border-blue-500'
                  : index < currentExerciseIndex
                    ? 'bg-gray-200 line-through'
                    : 'bg-white'
              }`}
            >
              <p className="font-medium">{exercise.name}</p>
              <p className="text-sm text-gray-600">
                {exercise.sets} sets × {exercise.reps} reps
              </p>
            </div>
          ))}
        </div>
      </div>

      {exerciseLogs.length > 0 && <ExerciseLog logs={exerciseLogs} />}
    </div>
  );
}
