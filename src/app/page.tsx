"use client";
import LeftSidebar from "@/components/LeftSidebar";
import Live from "@/components/Live";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { CustomFabricObject } from "@/types/type";
import { useRef } from "react";
import { fabric } from "fabric";

export default function Page() {
  //Referincia al canvas original
  const canvasRef = useRef<HTMLCanvasElement>(null);
 //Referincia al canvas copia
  const fabricRef = useRef<fabric.Canvas | null>(null);

  return (
    <main className="h-screen overflow-hidden ">
      <Navbar />

      <section className="flex h-full flex-row">
        <LeftSidebar />
        <Live />
        <RightSidebar />
      </section>
    </main>
  );
}
