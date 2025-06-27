import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPosition(position: string): string {
  const positionMap: Record<string, string> = {
    goalkeeper: "Goalkeeper (GK)",
    defender: "Defender (DF)", 
    midfielder: "Midfielder (MF)",
    forward: "Forward (FW)"
  };
  return positionMap[position] || position;
}

export function getPositionColor(position: string): string {
  const colorMap: Record<string, string> = {
    goalkeeper: "bg-blue-100 text-blue-800",
    defender: "bg-red-100 text-red-800",
    midfielder: "bg-yellow-100 text-yellow-800",
    forward: "bg-green-100 text-green-800"
  };
  return colorMap[position] || "bg-gray-100 text-gray-800";
}
