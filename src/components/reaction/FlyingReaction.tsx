import styles from "./index.module.css";

type Props = {
  x: number;
  y: number;
  timestamp: number;
  value: string;
};

// tailwind only generates classes written in full, so they can't be built at runtime
const TEXT_SIZES = ["text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl"];

export default function FlyingReaction({ x, y, timestamp, value }: Props) {
  return (
    <div
      className={`pointer-events-none absolute select-none ${
        styles.disappear
      } ${TEXT_SIZES[timestamp % TEXT_SIZES.length]} ${styles["goUp" + (timestamp % 3)]}`}
      style={{ left: x, top: y }}
    >
      <div className={styles["leftRight" + (timestamp % 3)]}>
        <div className="-translate-x-1/2 -translate-y-1/2 transform">
          {value}
        </div>
      </div>
    </div>
  );
}