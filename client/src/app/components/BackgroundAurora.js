// components/BackgroundAurora.js

"use client"; // This component uses animation, so it's a client component.

const BackgroundAurora = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        zIndex: 0, // Ensure it's behind everything
      }}
    >
      <div
        className="animate-aurora"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "200%", // Make it larger than the viewport to hide edges
          height: "200%",
          transform: "translate(-50%, -50%)",
          // The magic gradient for the aurora effect
          backgroundImage: `radial-gradient(ellipse at 20% 20%, hsla(217, 100%, 50%, 0.3) 0%, transparent 50%),
                           radial-gradient(ellipse at 80% 30%, hsla(288, 100%, 50%, 0.25) 0%, transparent 50%),
                           radial-gradient(ellipse at 60% 80%, hsla(180, 100%, 50%, 0.2) 0%, transparent 50%)`,
        }}
      />
    </div>
  );
};

// Add the keyframes animation to your global CSS file (e.g., styles/globals.css)
/*
@keyframes aurora {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.animate-aurora {
  animation: aurora 30s linear infinite;
}
*/

export default BackgroundAurora;