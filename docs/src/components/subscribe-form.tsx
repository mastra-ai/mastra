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
  className,
  showLabel = true,
  idleIcon,
  successIcon,
  buttonClassName,
  inputClassName,
  placeholder,
}: {
  className?: string;
  showLabel?: boolean;
  idleIcon?: React.ReactNode;
  successIcon?: React.ReactNode;
  buttonClassName?: string;
  inputClassName?: string;
  placeholder?: string;
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
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "mt-16 items-end flex flex-col md:flex-row w-full gap-2 ",
          className,
        )}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1 w-full">
              {showLabel ? <FormLabel>Mastra Newsletter</FormLabel> : null}

              <FormControl>
                <input
                  placeholder={
                    placeholder || "Follow along with the weekly changelog"
                  }
                  {...field}
                  className={cn(
                    "bg-transparent placeholder:text-text-3 text-sm placeholder:text-sm md:min-w-[400px] flex-1 focus:outline-none focus:ring-1 h-[35px] focus:ring-[#3359BC] w-full py-[0.56rem] px-4 dark:border-neutral-700  border rounded-md",
                    inputClassName,
                  )}
                />
              </FormControl>
              <span className="md:absolute flex gap-2 items-center">
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
            "dark:bg-white bg-[#2a2a2a] w-full md:w-[110px] rounded-md hover:opacity-90 h-[35px] justify-center flex items-center px-4 py-[0.56rem] font-semibold text-[0.9rem] text-white dark:text-black",
            buttonClassName,
          )}
          disabled={buttonState === "loading"}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              initial={{ opacity: 0, y: -25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 25 }}
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
