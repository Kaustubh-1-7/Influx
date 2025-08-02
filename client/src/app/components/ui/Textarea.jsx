// app/(components)/ui/Textarea.jsx
'use client';
export const Textarea = ({ className = "", ...props }) => {
  return (
    <textarea
      className={`input min-h-[80px] ${className}`} // input class provides most styling
      {...props}
    />
  );
};