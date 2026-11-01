"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ThreadData } from "@liveblocks/client";
import { Thread } from "@liveblocks/react-comments";
import { ThreadMetadata } from "../../../liveblocks.config";
import { isNewThread } from "@/lib/newThreads";



type Props = {
  thread: ThreadData<ThreadMetadata>;
  onFocus: (threadId: string) => void;
};

export const PinnedThread = ({ thread, onFocus, ...props }: Props) => {
  // Open pinned threads that have just been created
  const [minimized, setMinimized] = useState(!isNewThread(thread.id));

  // the content now re-renders with every thread update, so the avatar has to stay fixed
  const [avatarSrc] = useState(
    () => `https://liveblocks.io/avatars/avatar-${Math.floor(Math.random() * 30)}.png`
  );

  /**
   * memoize the result of this function so that it doesn't change on every render but only when the thread changes
   * Memo is used to optimize performance and avoid unnecessary re-renders.
   *
   * useMemo: https://react.dev/reference/react/useMemo
   */

  const memoizedContent = useMemo(
    () => (
      <div
        className='absolute flex cursor-pointer gap-4'
        {...props}
        onClick={() => onFocus(thread.id)}
      >
        {/* only the pin toggles the thread, clicks inside it are for writing or reacting */}
        <div
          className='relative flex h-9 w-9 select-none items-center justify-center rounded-bl-full rounded-br-full rounded-tl-md rounded-tr-full bg-white shadow'
          data-draggable={true}
          onClick={() => setMinimized(!minimized)}
        >
          <Image
            src={avatarSrc}
            alt='Dummy Name'
            width={28}
            height={28}
            draggable={false}
            className='rounded-full'
          />
        </div>
        {!minimized ? (
          <div className='flex min-w-60 flex-col overflow-hidden rounded-lg bg-white text-sm shadow'>
            <Thread
              thread={thread}
              indentCommentContent={false}
              onKeyUp={(e) => {
                e.stopPropagation();
              }}
            />
          </div>
        ) : null}
      </div>
    ),
    [thread, onFocus, minimized]
  );

  return <>{memoizedContent}</>;
};
