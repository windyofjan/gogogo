import React from "react";

interface BaseballStitchProps {
  className?: string;
  vertical?: boolean;
}

export default function BaseballStitch({ className = "", vertical = false }: BaseballStitchProps) {
  if (vertical) {
    return (
      <div className={`relative flex flex-col items-center h-full w-4 overflow-hidden ${className}`}>
        {/* Left Stitch Row */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] border-r-2 border-dashed border-red-500 opacity-80" />
        {/* Right Stitch Row */}
        <div className="absolute right-0 top-0 bottom-0 w-[2px] border-l-2 border-dashed border-red-500 opacity-80" />
        {/* Decorative stitch marks */}
        <svg className="w-full h-full opacity-60" preserveAspectRatio="none" viewBox="0 0 16 100">
          <path
            d="M 2 5 L 8 10 M 2 25 L 8 30 M 2 45 L 8 50 M 2 65 L 8 70 M 2 85 L 8 90"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 14 5 L 8 10 M 14 25 L 8 30 M 14 45 L 8 50 M 14 65 L 8 70 M 14 85 L 8 90"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative h-6 w-full overflow-hidden flex items-center justify-center my-2 ${className}`}>
      {/* Background soft white leather feel */}
      <div className="absolute inset-x-0 h-[2px] bg-red-400/20" />
      <svg className="w-full h-6 opacity-80" preserveAspectRatio="none" viewBox="0 0 100 24">
        {/* Top stitch curve */}
        <path
          d="M 0 6 Q 5 2 10 6 Q 15 10 20 6 Q 25 2 30 6 Q 35 10 40 6 Q 45 2 50 6 Q 55 10 60 6 Q 65 2 70 6 Q 75 10 80 6 Q 85 2 90 6 Q 95 10 100 6"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="2,2"
        />
        {/* Bottom stitch curve */}
        <path
          d="M 0 18 Q 5 22 10 18 Q 15 14 20 18 Q 25 22 30 18 Q 35 14 40 18 Q 45 22 50 18 Q 55 14 60 18 Q 65 22 70 18 Q 75 14 80 18 Q 85 22 90 18 Q 95 14 100 18"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="2,2"
        />
        {/* Stitch lines crossing */}
        <path
          d="M 2 4 L 8 8 M 12 4 L 18 8 M 22 4 L 28 8 M 32 4 L 38 8 M 42 4 L 48 8 M 52 4 L 58 8 M 62 4 L 68 8 M 72 4 L 78 8 M 82 4 L 88 8 M 92 4 L 98 8"
          stroke="#ef4444"
          strokeWidth="1"
        />
        <path
          d="M 2 20 L 8 16 M 12 20 L 18 16 M 22 20 L 28 16 M 32 20 L 38 16 M 42 20 L 48 16 M 52 20 L 58 16 M 62 20 L 68 16 M 72 20 L 78 16 M 82 20 L 88 16 M 92 20 L 98 16"
          stroke="#ef4444"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
