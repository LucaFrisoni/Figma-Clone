import React from "react";
import styles from "./Avatar.module.css";
import Image from "next/image";

const IMAGE_SIZE = 48;
const AVATARS_COUNT = 30;

export function Avatar({
  name,
  seed,
  otherStyles,
}: {
  otherStyles: string;
  name: string;
  seed: number;
}) {
  return (
    <div
      className={`${styles.avatar} ${otherStyles} h-9 w-9`}
      data-tooltip={name}
    >
      <Image
        src={`https://liveblocks.io/avatars/avatar-${seed % AVATARS_COUNT}.png`}
        fill
        alt={name}
        className={styles.avatar_picture}
      />
    </div>
  );
}
