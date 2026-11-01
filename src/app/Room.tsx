"use client";

import { ReactNode } from "react";
import { RoomProvider } from "../../liveblocks.config";
import { ClientSideSuspense } from "@liveblocks/react";
import { LiveMap } from "@liveblocks/client";
import Loader from "@/components/Loader";

export function Room({ children }: { children: ReactNode }) {

  // Coment
  return (
    <RoomProvider
      // tests and previews use their own room to keep away from the real canvas
      id={process.env.NEXT_PUBLIC_LIVEBLOCKS_ROOM_ID || "my-room"}
      initialPresence={{
        cursor: null,
        message: null,
      }}
      initialStorage={{
        canvasObjects:new LiveMap()
      }}
    >
      <ClientSideSuspense fallback={<Loader />}>
        {() => children}
      </ClientSideSuspense>
    </RoomProvider>
  );
}
