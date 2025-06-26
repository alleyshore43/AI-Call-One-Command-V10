import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export default function LoadingSkeleton({ 
  className = '', 
  variant = 'text',
  width,
  height,
  lines = 1
}: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-md';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const getDefaultDimensions = () => {
    switch (variant) {
      case 'circular':
        return { width: '40px', height: '40px' };
      case 'rectangular':
        return { width: '100%', height: '120px' };
      case 'text':
      default:
        return { width: '100%', height: '20px' };
    }
  };

  const defaults = getDefaultDimensions();
  const style = {
    width: width || defaults.width,
    height: height || defaults.height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()} ${index < lines - 1 ? 'mb-2' : ''}`}
            style={{
              ...style,
              width: index === lines - 1 ? '75%' : style.width, // Last line is shorter
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={style}
    />
  );
}

// Predefined skeleton components for common use cases
export function DashboardCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <LoadingSkeleton variant="text" width="120px" height="16px" />
        <LoadingSkeleton variant="circular" width="32px" height="32px" />
      </div>
      <LoadingSkeleton variant="text" width="80px" height="32px" className="mb-2" />
      <LoadingSkeleton variant="text" width="150px" height="14px" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <LoadingSkeleton variant="text" height="16px" />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <LoadingSkeleton variant="text" width="150px" height="20px" className="mb-4" />
      <LoadingSkeleton variant="rectangular" width="100%" height="300px" />
    </div>
  );
}