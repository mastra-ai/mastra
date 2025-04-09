'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { useMemo, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { MoreHorizontalIcon, TrashIcon } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { fetcher } from '@/lib/utils';
import { StorageThreadType } from '@mastra/core/memory';

type GroupedHistory = {
  today: StorageThreadType[];
  yesterday: StorageThreadType[];
  lastWeek: StorageThreadType[];
  lastMonth: StorageThreadType[];
  older: StorageThreadType[];
};

const ThreadItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: StorageThreadType;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
          <span>{chat.title}</span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();
  const pathname = usePathname();
  const {
    data: threads,
    isLoading,
    mutate,
  } = useSWR<Array<StorageThreadType>>(user ? '/api/threads' : null, fetcher, {
    fallbackData: [],
  });

  useEffect(() => {
    const refetchThreads = async (count = 0) => {
      const newThreads = await mutate();
      if (newThreads?.length) {
        const lastThread = newThreads[newThreads.length - 1];
        count = count + 1;
        if (lastThread?.title?.toLowerCase()?.includes('new thread') && count < 3) {
          setTimeout(() => {
            refetchThreads(count);
          }, 500);
        }
      }
    };
    if (threads?.length) {
      const lastThread = threads[threads.length - 1];
      if (lastThread?.title?.toLowerCase()?.includes('new thread')) {
        setTimeout(() => {
          refetchThreads();
        }, 500);
      }
    }
  }, [threads, mutate]);

  useEffect(() => {
    mutate();
  }, [pathname, mutate]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const handleDelete = async () => {
    const deletePromise = fetch(`/api/threads?id=${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate(history => {
          if (history) {
            return history.filter(h => h.id !== id);
          }
        });
        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push('/');
    }
  };

  const groupedThreadsByDate = useMemo(() => {
    if (!threads || !threads.length) return { today: [], yesterday: [], lastWeek: [], lastMonth: [], older: [] };
    const now = new Date();
    const oneWeekAgo = subWeeks(now, 1);
    const oneMonthAgo = subMonths(now, 1);

    return threads.reduce(
      (groups, chat) => {
        const chatDate = new Date(chat.createdAt);

        if (isToday(chatDate)) {
          groups.today.push(chat);
        } else if (isYesterday(chatDate)) {
          groups.yesterday.push(chat);
        } else if (chatDate > oneWeekAgo) {
          groups.lastWeek.push(chat);
        } else if (chatDate > oneMonthAgo) {
          groups.lastMonth.push(chat);
        } else {
          groups.older.push(chat);
        }

        return groups;
      },
      {
        today: [],
        yesterday: [],
        lastWeek: [],
        lastMonth: [],
        older: [],
      } as GroupedHistory,
    );
  }, [threads]);

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">Today</div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map(item => (
              <div key={item} className="rounded-md h-8 flex gap-2 px-2 items-center">
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (history?.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Your conversations will appear here once you start chatting!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {history && (
              <>
                {groupedThreadsByDate.today.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-sidebar-foreground/50">Today</div>
                    {groupedThreadsByDate.today.map(chat => (
                      <ThreadItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={chatId => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </>
                )}

                {groupedThreadsByDate.yesterday.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">Yesterday</div>
                    {groupedThreadsByDate.yesterday.map(chat => (
                      <ThreadItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={chatId => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </>
                )}

                {groupedThreadsByDate.lastWeek.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">Last 7 days</div>
                    {groupedThreadsByDate.lastWeek.map(chat => (
                      <ThreadItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={chatId => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </>
                )}

                {groupedThreadsByDate.lastMonth.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">Last 30 days</div>
                    {groupedThreadsByDate.lastMonth.map(chat => (
                      <ThreadItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={chatId => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </>
                )}

                {groupedThreadsByDate.older.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">Older</div>
                    {groupedThreadsByDate.older.map(chat => (
                      <ThreadItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={chatId => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
