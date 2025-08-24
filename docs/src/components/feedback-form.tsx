"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/forms";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { T } from "gt-next/client";
import { X } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const feedbackSchema = z.object({
  feedback: z.string().min(5, "Please enter your feedback"),
  rating: z.number().min(1).max(5).optional(),
  page: z.string(),
  userAgent: z.string().optional(),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
}

const ratings = [
  { rating: 3, emoji: "😊", label: "Helpful" },
  { rating: 2, emoji: "😐", label: "Somewhat helpful" },
  { rating: 1, emoji: "😕", label: "Not helpful" },
];

export const FeedbackForm = ({
  isOpen,
  onClose,
  currentPage,
}: FeedbackFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      feedback: "",
      rating: 5,
      page: currentPage,
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : "",
    },
    reValidateMode: "onSubmit",
  });

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const url =
        process.env.NODE_ENV === "production"
          ? "/docs/api/feedback"
          : "/api/feedback";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      setSubmitStatus("success");
      form.reset();

      setTimeout(() => {
        onClose();
        setSubmitStatus("idle");
      }, 2000);
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRating = form.watch("rating");

  if (!isOpen) return null;

  return (
    <div className="mt-4 p-4 border border-gray-200 dark:border-borders-1 rounded-lg bg-white dark:bg-[var(--primary-bg)]">
      {submitStatus === "success" ? (
        <div className="text-center py-4">
          <p className="text-sm text-black dark:text-white">
            <T id="feedback.success.message">
              Thank you! Your feedback has been submitted.
            </T>
          </p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                <T id="feedback.rating_label">Was this helpful?</T>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-3 flex-col items-start">
              <div className="flex gap-1 flex-shrink-0">
                {ratings.map(({ rating, emoji, label }) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => form.setValue("rating", rating)}
                    className={cn(
                      "w-8 h-8 focus-visible:outline-2 focus-visible:outline-accent-green rounded-full flex items-center justify-center text-lg transition-all hover:scale-110",
                      currentRating === rating
                        ? " ring-2 ring-accent-green"
                        : "",
                    )}
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <FormField
                control={form.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Textarea
                        placeholder="Your feedback..."
                        className="min-h-[60px] text-black focus:outline focus:outline-accent-green dark:text-white resize-none text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="dark:bg-[#121212] focus-visible:outline-2 focus-visible:outline-accent-green bg-[var(--light-color-surface-3)] w-full rounded-md hover:opacity-90 h-[32px] justify-center flex items-center px-4 text-[var(--light-color-text-5)] dark:text-white text-[14px]"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "Send"
                )}
              </button>
            </div>

            {errorMessage && (
              <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-red-500 dark:text-red-400">
                  <T id="feedback.error">
                    Something went wrong. Please try again.
                  </T>
                  {errorMessage && (
                    <span className="block mt-1 opacity-75">
                      {errorMessage}
                    </span>
                  )}
                </p>
              </div>
            )}
          </form>
        </Form>
      )}
    </div>
  );
};
