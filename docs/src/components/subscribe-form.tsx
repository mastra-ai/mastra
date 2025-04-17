"use client";
import { useForm } from "react-hook-form";

import { cn } from "@/lib/utils";
import Spinner from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/forms";
import { useTheme } from "nextra-theme-docs";
import { T, Var } from "gt-next/client";

export const formSchema = z.object({
  email: z.string().email(),
});

const buttonCopy = ({
  idleIcon,
  successIcon,
  isDark,
}: {
  idleIcon?: React.ReactNode;
  successIcon?: React.ReactNode;
  isDark?: boolean;
}) => ({
  idle: idleIcon ? idleIcon : "Subscribe",
  loading: (
    <Spinner
      className="w-4 h-4 !duration-300"
      color={isDark ? "#000" : "#fff"}
    />
  ),
  success: successIcon ? successIcon : "Subscribed!",
});

export const SubscribeForm = ({
  idleIcon,
  successIcon,
  placeholder,
  label,
  className,
  showLabel = true,
  inputClassName,
  buttonClassName,
}: {
  idleIcon?: React.ReactNode;
  successIcon?: React.ReactNode;
  placeholder?: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
  inputClassName?: string;
  buttonClassName?: string;
}) => {
  const [buttonState, setButtonState] = useState("idle");
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
    reValidateMode: "onSubmit",
  });
  const { theme } = useTheme();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (buttonState === "success") return;

    const sanitizedEmail = values.email.trim();
    if (!sanitizedEmail) {
      return toast.error("Please enter an email");
    }
    setButtonState("loading");

    try {
      const response = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${process.env.NEXT_PUBLIC_HS_PORTAL_ID}/${process.env.NEXT_PUBLIC_HS_FORM_GUID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: [
              {
                objectTypeId: "0-1",
                name: "email",
                value: sanitizedEmail,
              },
            ],

            context: {
              pageUri: window.location.href,
              pageName: document.title,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Submission failed");
      }
      setButtonState("success");
      await new Promise((resolve) => setTimeout(resolve, 1750));
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Error submitting form");
      setButtonState("idle");
    } finally {
      setButtonState("idle");
      form.reset();
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn(
          "mt-[2.38rem] items-end flex flex-col md:flex-row w-full gap-2 ",
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            form.handleSubmit(onSubmit)();
          }
        }}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1 w-full">
              {showLabel ? (
                <T id="components.subscribe_form.0">
                  <FormLabel className="text-[13px] mb-[0.69rem] block text-gray-500 dark:text-[#E6E6E6]">
                    <Var>{label || "Mastra Newsletter"}</Var>
                  </FormLabel>
                </T>
              ) : null}

              <FormControl>
                <input
                  placeholder={placeholder || "you@example.com"}
                  {...field}
                  className={cn(
                    "bg-transparent placeholder:text-text-[#939393] text-sm placeholder:text-sm flex-1 focus:outline-none focus:ring-1 h-[35px] focus:ring-[hsl(var(--tag-green))] w-full py-[0.56rem] px-4 dark:border-[#343434] border rounded-md",
                    inputClassName,
                  )}
                />
              </FormControl>
              <span className="flex gap-2 items-center">
                {form.formState.errors.email && (
                  <AlertCircle size={12} className="text-red-500" />
                )}
                <FormMessage className="text-red-500" />
              </span>
            </FormItem>
          )}
        />

        <button
          className={cn(
            "dark:bg-[#121212] bg-[#2a2a2a] w-full rounded-md hover:opacity-90 h-[32px] justify-center flex items-center px-4 text-white dark:text-white text-[14px]",
            buttonClassName,
          )}
          onClick={(e) => {
            e.preventDefault();
            form.handleSubmit(onSubmit)();
          }}
          disabled={buttonState === "loading"}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              key={buttonState}
            >
              {
                buttonCopy({
                  idleIcon,
                  successIcon,
                  isDark: theme === "dark",
                })[buttonState as keyof typeof buttonCopy]
              }
            </motion.span>
          </AnimatePresence>
        </button>
      </form>
    </Form>
  );
};
