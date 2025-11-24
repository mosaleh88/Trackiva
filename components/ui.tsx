import React from 'react';

// Card
export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`bg-white shadow-sm border border-slate-200 rounded-xl p-6 ${className}`}>
    {children}
  </div>
);

// Button
export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = "", ...props }) => {
  const baseStyle = "rounded-lg font-medium transition-all duration-200 flex items-center gap-2 justify-center disabled:opacity-50";
  
  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };

  const variants = {
    primary: "bg-primary text-white hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-danger text-white hover:bg-red-600",
    ghost: "hover:bg-slate-100 text-slate-600"
  };

  return (
    <button className={`${baseStyle} ${sizes[size]} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
};

// Badge
export interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'orange' | 'purple';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'blue', className = "" }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    gray: "bg-slate-100 text-slate-800",
    orange: "bg-orange-100 text-orange-800",
    purple: "bg-purple-100 text-purple-800"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.blue} ${className}`}>
      {children}
    </span>
  );
};

// Input
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = "", ...props }) => (
  <input 
    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-start ${className}`}
    {...props}
  />
);

// Select
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = "", ...props }) => (
  <div className="relative">
    <select 
      className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none text-start ${className}`}
      {...props}
    />
    <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center px-2 pointer-events-none text-slate-500">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
);