import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "../css/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "./ui/forms";
import { Label } from "./ui/label";
import { CancelIcon } from "./copy-page-icons";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

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
  {
    rating: 3,
    emoji: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z" />
        <line x1="9" x2="9.01" y1="9" y2="9" />
        <line x1="15" x2="15.01" y1="9" y2="9" />
      </svg>
    ),
    label: "Helpful",
  },
  {
    rating: 2,
    emoji: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="8" x2="16" y1="15" y2="15" />
        <line x1="9" x2="9.01" y1="9" y2="9" />
        <line x1="15" x2="15.01" y1="9" y2="9" />
      </svg>
    ),
    label: "Somewhat helpful",
  },
  {
    rating: 1,
    emoji: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <path d="M7.5 8 10 9" />
        <path d="m14 9 2.5-1" />
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
      </svg>
    ),
    label: "Not helpful",
  },
];

export const FeedbackForm = ({
  isOpen,
  onClose,
  currentPage,
}: FeedbackFormProps) => {
  const { siteConfig } = useDocusaurusContext();
  const { mastraWebsite } = siteConfig.customFields as {
    mastraWebsite?: string;
  };

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
      if (!mastraWebsite) {
        throw new Error("Website URL is not configured");
      }

      const response = await fetch(`${mastraWebsite}/api/feedback`, {
        method: "POST",
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
    <div className="p-4 pt-2 px-0 border max-h-[400px] border-gray-200 dark:border-borders-1 rounded-[10px] bg-white dark:bg-[var(--primary-bg)]">
      {submitStatus === "success" ? (
        <div className="text-center py-4 px-2">
          <p className="text-sm mb-0! text-black dark:text-white">
            Thank you! Your feedback has been submitted
          </p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex items-center px-4 pb-2 border-b-[0.5px] border-(--border) justify-between ">
              <Label htmlFor="feedback" className="font-semibold">
                Was this helpful?
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 rounded-full hover:bg-(--mastra-surface-3) transition-colors"
              >
                <CancelIcon className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-3 py-3 px-4 flex-col items-start">
              <div className="flex gap-1 items-center justify-center flex-shrink-0">
                {ratings.map(({ rating, emoji, label }) => (
                  <Button
                    variant="ghost"
                    key={rating}
                    type="button"
                    onClick={() => form.setValue("rating", rating)}
                    className={cn(
                      "w-8 h-8 rounded-full flex hover:bg-(--mastra-surface-3)  items-center justify-center text-lg transition-all hover:scale-110",
                      currentRating === rating
                        ? " ring-2 ring-(--mastra-green-accent)"
                        : "",
                    )}
                    title={label}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>

              <FormField
                control={form.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem className="flex-1 w-full">
                    <FormControl>
                      <Textarea
                        placeholder="Your feedback..."
                        className="min-h-[60px] w-full text-black  dark:text-white resize-none text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="dark:bg-[#121212] bg-(--mastra-surface-3) w-full rounded-[10px] hover:opacity-90 h-8 justify-center flex items-center px-4 text-[var(--light-color-text-5)] dark:text-white text-[14px]"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>

            {errorMessage && (
              <div className="mt-3 mx-4 p-2 rounded-[10px] bg-red-50 dark:bg-red-900/20">
                <p className="text-xs mb-0! text-red-500 font-mono dark:text-red-400">
                  Something went wrong. Please try again
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
