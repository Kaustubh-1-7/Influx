// app/(components)/ui/Button.jsx
'use client';
export const Button = ({ children, className = "", ...props }) => {
  return (
    <button
      className={`btn ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};