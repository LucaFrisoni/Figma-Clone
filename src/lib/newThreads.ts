// Remembers the comment threads created in this tab, so they can open by themselves when they appear.
const newThreadIds = new Set<string>();

export const markThreadAsNew = (threadId: string) => {
  newThreadIds.add(threadId);
};

export const isNewThread = (threadId: string) => newThreadIds.has(threadId);
