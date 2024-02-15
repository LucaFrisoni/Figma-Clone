import React from "react";
import Cursor from "./Cursor";
import { COLORS } from "@/constants";
import { useOthers } from "../../../liveblocks.config";

const LiveCursors = () => {
  
  const others = useOthers()


  //  Por cada usuario externo creamos un cursor
  return others.map(({ connectionId, presence }) => {
    if (!presence?.cursor) return null;

    return (
      <Cursor
        key={connectionId}
        color={COLORS[Number(connectionId) % COLORS.length]}
        x={presence.cursor.x}
        y={presence.cursor.y}
        message={presence.message || ""}
      />
    );
  });


};

export default LiveCursors;
