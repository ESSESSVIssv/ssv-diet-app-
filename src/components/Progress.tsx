import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ProgressBarProps {
  progress: number;
  colorClass: string;
  bgColorClass: string;
}

export function MiniProgressBar({ progress, colorClass, bgColorClass }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  
  return (
    <div className={cn("h-2 w-full rounded-full overflow-hidden", bgColorClass)}>
      <motion.div 
        className={cn("h-full rounded-full", colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </div>
  );
}

export function CircularProgress({ 
  progress, 
  size = 120, 
  strokeWidth = 10,
  children
}: { 
  progress: number, 
  size?: number, 
  strokeWidth?: number,
  children?: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.min(100, Math.max(0, progress));
  const dashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-slate-100 fill-none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-emerald-400 fill-none drop-shadow-sm"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
