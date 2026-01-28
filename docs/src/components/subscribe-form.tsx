import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@site/src/components/ui/forms'
import { Spinner } from './spinner'
import { cn } from '@site/src/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { z } from 'zod/v4'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { Button } from './ui/button'

export const formSchema = z.object({
  email: z.email(),
})

const buttonCopy = ({
  idleIcon,
  successIcon,
}: {
  idleIcon?: React.ReactNode
  successIcon?: React.ReactNode
  isDark?: boolean
}) => ({
  idle: idleIcon ? idleIcon : 'Subscribe',
  loading: <Spinner className="h-4 w-4 text-black duration-300! dark:text-white" />,
  success: successIcon ? successIcon : 'Subscribed!',
})

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
  idleIcon?: React.ReactNode
  successIcon?: React.ReactNode
  placeholder?: string
  label?: string
  className?: string
  showLabel?: boolean
  inputClassName?: string
  buttonClassName?: string
}) => {
  const { siteConfig } = useDocusaurusContext()
  const { hsPortalId, hsFormGuid } = siteConfig.customFields as {
    hsPortalId?: string
    hsFormGuid?: string
  }

  const [buttonState, setButtonState] = useState('idle')
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
    reValidateMode: 'onSubmit',
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (buttonState === 'success') return

    const sanitizedEmail = values.email.trim()
    setButtonState('loading')

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
      )

      if (!response.ok) {
        throw new Error('Submission failed')
      }
      setButtonState('success')
      await new Promise(resolve => setTimeout(resolve, 1750))
    } catch (error) {
      console.error('Error submitting form:', error)
      setButtonState('idle')
    } finally {
      setButtonState('idle')
      form.reset()
    }
  }

  return (
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col items-end gap-2', className)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            form.handleSubmit(onSubmit)()
          }
        }}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full flex-1">
              {showLabel ? (
                <FormLabel className="mb-[0.69rem] block text-[13px] text-gray-500 dark:text-[#E6E6E6]">
                  {label || 'Mastra Newsletter'}
                </FormLabel>
              ) : null}

              <FormControl>
                <input
                  placeholder={placeholder || 'you@example.com'}
                  {...field}
                  className={cn(
                    'h-8.75 w-full flex-1 rounded-[10px] border border-(--border) bg-transparent px-4 py-[0.56rem] text-sm placeholder:text-sm placeholder:text-[#939393] focus:ring-2 focus:ring-(--mastra-green-accent)/50 focus:outline-none focus-visible:border-green-500 dark:border-[#343434] dark:text-white',
                    inputClassName,
                  )}
                />
              </FormControl>
              <span className="flex items-center gap-2">
                {form.formState.errors.email && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                )}
                <FormMessage className="mb-0! text-red-500" />
              </span>
            </FormItem>
          )}
        />

        <Button
          className={cn(
            'flex h-8 w-full items-center justify-center rounded-[10px] bg-(--mastra-surface-3) px-4 text-[14px] hover:opacity-90 dark:text-white',
            buttonClassName,
          )}
          onClick={e => {
            e.preventDefault()
            form.handleSubmit(onSubmit)()
          }}
          disabled={buttonState === 'loading'}
        >
          {
            buttonCopy({
              idleIcon,
              successIcon,
            })[buttonState as keyof ReturnType<typeof buttonCopy>]
          }
        </Button>
      </form>
    </Form>
  )
}

export default SubscribeForm
