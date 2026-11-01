"use client"
import { getNameFromId } from "@/lib/utils";
import { useOthers, useSelf } from "../../../liveblocks.config";
import { Avatar } from "./Avatar";
import styles from "./index.module.css"
import { useMemo } from "react";

const ActiveUser = ()=>{
  const users = useOthers();
  const currentUser = useSelf();
  const hasMoreUsers = users.length > 3;

  // users changes with every cursor movement, but the avatars only depend on who is connected
  const connectedIds = users.map(({ connectionId }) => connectionId).join();

const memorizedUsers = useMemo(()=>{
    return( <div className="flex items-center justify-center gap-1 py-2">
    <div className="flex pl-3">

    {currentUser && (
          <Avatar  name="You" seed={currentUser.connectionId} otherStyles="border-[3px] border-primary-green" />
      )}


      {users.slice(0, 3).map(({ connectionId, info }) => {
        return (
          <Avatar key={connectionId}  name={getNameFromId(connectionId)} seed={connectionId} otherStyles="-ml-3"/>
        );
      })}

      {hasMoreUsers && <div className={styles.more}>+{users.length - 3}</div>}


    </div>
  </div>)
},[connectedIds, currentUser?.connectionId])


  return memorizedUsers
}


export default ActiveUser
