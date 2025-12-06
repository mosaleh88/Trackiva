import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Card - Glassmorphic
export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`
    relative overflow-hidden
    bg-white/60 dark:bg-slate-900/50 
    backdrop-blur-xl backdrop-saturate-150
    shadow-glass 
    border border-white/30 dark:border-white/10
    rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 transition-all duration-300 ease-spring hover:shadow-glass-hover hover:-translate-y-1
    ${className}
  `}>
    {/* Optional subtle gradient overlay for depth */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />
    <div className="relative z-10 h-full w-full">
      {children}
    </div>
  </div>
);

// Button - Pill shaped, soft glow
export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg'| 'icon';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = "", ...props }) => {
  const baseStyle = "font-semibold transition-all duration-300 ease-out flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transform tracking-wide";
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-full",
    md: "px-4 md:px-5 py-2 md:py-2.5 text-sm rounded-2xl",
    lg: "px-6 md:px-8 py-3 md:py-3.5 text-lg rounded-2xl",
    icon: "h-11 w-11 p-0 rounded-xl",
  };

  const variants = {
    primary: "bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 border border-white/20 animate-breathing-glow",
    secondary: "bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-700/80 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm hover:shadow-lg",
    danger: "bg-danger/80 text-white shadow-lg shadow-danger/30 hover:shadow-danger/50 hover:-translate-y-0.5 border border-white/20 backdrop-blur-md",
    ghost: "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-2xl"
  };

  return (
    <button className={`${baseStyle} ${sizes[size]} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
};

// Badge - Soft translucent pills
export interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'orange' | 'purple';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'blue', className = "" }) => {
  const colors = {
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-800/50",
    green: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-800/50",
    red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-800/50",
    yellow: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200/50 dark:border-yellow-800/50",
    gray: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50",
    orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200/50 dark:border-orange-800/50",
    purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200/50 dark:border-purple-800/50"
  };
  return (
    <span className={`px-2 md:px-3 py-1 rounded-xl text-[10px] md:text-xs font-bold border backdrop-blur-sm shadow-sm ${colors[color] || colors.blue} ${className}`}>
      {children}
    </span>
  );
};

// Input - Filled glass style
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = "", ...props }) => (
  <div className="relative group">
    <input 
      className={`
        w-full px-4 py-2.5 md:py-3 
        bg-white/50 dark:bg-slate-900/50 
        backdrop-blur-lg
        border border-slate-200/60 dark:border-slate-700/60 
        text-slate-900 dark:text-white 
        rounded-xl 
        focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-white/80 dark:focus:bg-slate-900/80
        transition-all duration-300 ease-out
        placeholder:text-slate-400 dark:placeholder:text-slate-500
        text-start shadow-inner-light
        text-base md:text-sm
        ${className}
      `}
      {...props}
    />
  </div>
);

// Modal - Glassmorphic
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 
                 bg-black/40 backdrop-blur-md
                 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-700
                   max-h-[90vh] overflow-y-auto w-full max-w-lg
                   animate-in zoom-in-95 duration-300 ease-spring
                   ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 border-b border-slate-200/50 dark:border-slate-700/50">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white pr-10">
            {title}
          </h3>
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all text-slate-500 dark:text-slate-400">
            <X size={22} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// Select - Filled glass style
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = "", ...props }) => (
  <div className="relative">
    <select 
      className={`
        w-full px-4 py-2.5 md:py-3 
        bg-white/50 dark:bg-slate-900/50 
        backdrop-blur-lg
        border border-slate-200/60 dark:border-slate-700/60 
        text-slate-900 dark:text-white 
        rounded-xl
        focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
        transition-all duration-300 ease-out
        appearance-none text-start shadow-inner-light
        cursor-pointer hover:bg-white/60 dark:hover:bg-slate-800/60
        text-base md:text-sm
        ${className}
      `}
      {...props}
    />
    <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center px-4 pointer-events-none text-slate-500">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
);

// Pagination
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  isRTL?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className = "", isRTL = false }) => {
  if (totalPages <= 1) return null;
  
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className={`flex justify-center items-center gap-3 mt-6 ${className}`}>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur border border-white/20 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
      >
        <PrevIcon size={18} />
      </button>
      <span className="text-sm font-bold text-slate-600 dark:text-slate-400 bg-white/30 dark:bg-slate-900/30 px-4 py-2 rounded-xl backdrop-blur border border-white/10">
        {isRTL ? `${totalPages} / ${currentPage}` : `${currentPage} of ${totalPages}`}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur border border-white/20 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
      >
        <NextIcon size={18} />
      </button>
    </div>
  );
};