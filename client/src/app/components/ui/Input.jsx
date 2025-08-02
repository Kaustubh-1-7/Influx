// app/(components)/ui/Input.jsx
export const Input = ({ className = "", ...props }) => {
  return (
    <input
      className={`input border-slate-300 dark:border-slate-600 focus:border-primary dark:focus:border-primary focus:ring-1 focus:ring-primary dark:focus:ring-primary ${className}`} // Added explicit border and focus
      {...props}
    />
  );
};