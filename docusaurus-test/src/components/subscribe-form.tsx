import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@site/src/components/ui/forms';
import { Spinner } from './spinner';
import { cn } from '../css/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { toast } from './custom-toast';
import { z } from 'zod/v4';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export const formSchema = z.object({
  email: z.email(),
});

const buttonCopy = ({
  idleIcon,
  successIcon,
}: {
  idleIcon?: React.ReactNode;
  successIcon?: React.ReactNode;
  isDark?: boolean;
}) => ({
  idle: idleIcon ? idleIcon : 'Subscribe',
  loading: <Spinner className="w-4 h-4 !duration-300 dark:text-white text-black" />,
  success: successIcon ? successIcon : 'Subscribed!',
});

const SubscribeForm = ({
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
  const { siteConfig } = useDocusaurusContext();
  const { hsPortalId, hsFormGuid } = siteConfig.customFields as {
    hsPortalId?: string;
    hsFormGuid?: string;
  };

  const [buttonState, setButtonState] = useState('idle');
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
    reValidateMode: 'onSubmit',
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (buttonState === 'success') return;

    const sanitizedEmail = values.email.trim();
    if (!sanitizedEmail) {
      return toast({
        title: 'Error Validating Email',
        description: 'Please enter an email',
      });
    }
    setButtonState('loading');
    try {
      const response = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${hsPortalId}/${hsFormGuid}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: [
              {
                objectTypeId: '0-1',
                name: 'email',
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
        throw new Error('Submission failed');
      }
      setButtonState('success');
      await new Promise(resolve => setTimeout(resolve, 1750));
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error Submitting Form',
        description: 'Please try again',
      });
      setButtonState('idle');
    } finally {
      setButtonState('idle');
      form.reset();
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn('mt-[2.38rem] outline items-end flex flex-col md:flex-row w-full gap-2 ', className)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
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
                <FormLabel className="text-[13px] mb-[0.69rem] block text-gray-500 dark:text-[#E6E6E6]">
                  {label || 'Mastra Newsletter'}
                </FormLabel>
              ) : null}

              <FormControl>
                <input
                  placeholder={placeholder || 'you@example.com'}
                  {...field}
                  className={cn(
                    'bg-transparent dark:text-white placeholder:text-[#939393] text-sm placeholder:text-sm flex-1 focus:outline-none focus:ring-1 h-[35px] focus:ring-[hsl(var(--tag-green))] w-full py-[0.56rem] px-4 dark:border-[#343434] border border-[var(--light-border-muted)] rounded-md',
                    inputClassName,
                  )}
                />
              </FormControl>
              <span className="flex gap-2 items-center">
                {form.formState.errors.email && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    className="text-red-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                )}
                <FormMessage className="text-red-500" />
              </span>
            </FormItem>
          )}
        />

        <button
          className={cn(
            'dark:bg-[#121212] focus-visible:outline-accent-green bg-[var(--light-color-surface-3)] w-full rounded-md hover:opacity-90 h-[32px] justify-center flex items-center px-4 text-[var(--light-color-text-5)] dark:text-white text-[14px]',
            buttonClassName,
          )}
          onClick={e => {
            e.preventDefault();
            form.handleSubmit(onSubmit)();
          }}
          disabled={buttonState === 'loading'}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              key={buttonState}
            >
              {
                buttonCopy({
                  idleIcon,
                  successIcon,
                })[buttonState as keyof typeof buttonCopy]
              }
            </motion.span>
          </AnimatePresence>
        </button>
      </form>
    </Form>
  );
};

export default SubscribeForm;
