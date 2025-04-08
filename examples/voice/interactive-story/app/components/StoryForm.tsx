'use client';

import { useState } from 'react';
import { z } from 'zod';

const storyFormSchema = z.object({
  genre: z.string().min(1, 'Genre is required'),
  protagonistDetails: z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(1, 'Age is required'),
    gender: z.string().min(1, 'Gender is required'),
    occupation: z.string().min(1, 'Occupation is required'),
  }),
  setting: z.string().min(1, 'Setting is required'),
});

type StoryFormData = z.infer<typeof storyFormSchema>;

interface StoryFormProps {
  onSubmit: (data: StoryFormData) => void;
}

export default function StoryForm({ onSubmit }: StoryFormProps) {
  const [formData, setFormData] = useState<StoryFormData>({
    genre: '',
    protagonistDetails: {
      name: '',
      age: 0,
      gender: '',
      occupation: '',
    },
    setting: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = storyFormSchema.parse(formData);
      setErrors({});
      onSubmit(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages: Record<string, string> = {};
        error.errors.forEach(err => {
          const path = err.path.join('.');
          errorMessages[path] = err.message;
        });
        setErrors(errorMessages);
      }
    }
  };

  const handleChange = (field: string, value: string | number) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'protagonistDetails') {
        setFormData(prev => ({
          ...prev,
          protagonistDetails: {
            ...prev.protagonistDetails,
            [child]: value,
          },
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
    >
      <div>
        <label className="block text-sm font-medium mb-2">
          Genre
          <input
            type="text"
            value={formData.genre}
            onChange={e => handleChange('genre', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </label>
        {errors['genre'] && <p className="text-red-500 text-sm mt-1">{errors['genre']}</p>}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Protagonist Details</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name
            <input
              type="text"
              value={formData.protagonistDetails.name}
              onChange={e => handleChange('protagonistDetails.name', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </label>
          {errors['protagonistDetails.name'] && (
            <p className="text-red-500 text-sm mt-1">{errors['protagonistDetails.name']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Age
            <input
              type="number"
              value={formData.protagonistDetails.age}
              onChange={e => handleChange('protagonistDetails.age', parseInt(e.target.value) || 0)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </label>
          {errors['protagonistDetails.age'] && (
            <p className="text-red-500 text-sm mt-1">{errors['protagonistDetails.age']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gender
            <input
              type="text"
              value={formData.protagonistDetails.gender}
              onChange={e => handleChange('protagonistDetails.gender', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </label>
          {errors['protagonistDetails.gender'] && (
            <p className="text-red-500 text-sm mt-1">{errors['protagonistDetails.gender']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Occupation
            <input
              type="text"
              value={formData.protagonistDetails.occupation}
              onChange={e => handleChange('protagonistDetails.occupation', e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </label>
          {errors['protagonistDetails.occupation'] && (
            <p className="text-red-500 text-sm mt-1">{errors['protagonistDetails.occupation']}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Setting
          <input
            type="text"
            value={formData.setting}
            onChange={e => handleChange('setting', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </label>
        {errors['setting'] && <p className="text-red-500 text-sm mt-1">{errors['setting']}</p>}
      </div>

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-sm shadow-sm"
      >
        Generate Story
      </button>
    </form>
  );
}
