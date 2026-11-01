"use client";

// Warns the user when the connection to the shared room is lost, because changes stop syncing.
import { useStatus } from "../../liveblocks.config";

const ConnectionStatus = () => {
  const status = useStatus();

  if (status !== "reconnecting" && status !== "disconnected") return null;

  return (
    <p
      role="status"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-sm bg-primary-black px-4 py-2 text-xs text-white shadow"
    >
      Connection lost. Trying to reconnect, your latest changes may not be saved yet.
    </p>
  );
};

export default ConnectionStatus;
