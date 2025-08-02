// src/components/VantaDotsBackground.jsx
"use client"; // This is essential for any component using browser-only features.

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script'; // Use Next.js's Script component for safe loading

const VantaDotsBackground = () => {
  const [vantaEffect, setVantaEffect] = useState(null);
  const vantaRef = useRef(null);

  // The useEffect hook is now only for cleaning up the effect when the component unmounts.
  useEffect(() => {
    return () => {
      if (vantaEffect) {
        vantaEffect.destroy();
      }
    };
  }, [vantaEffect]);

  return (
    <>
      {/* This is the div that Vanta will attach its canvas to */}
      <div
        ref={vantaRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1, // This is crucial for making it a background
        }}
      />

      {/* 
        Load the necessary scripts. We load Three.js first, and in its `onLoad` callback,
        we trigger the loading and initialization of Vanta to guarantee the correct order.
      */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          // Once THREE.js is loaded, create and append the Vanta script
          const vantaScript = document.createElement('script');
          vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.dots.min.js';
          document.body.appendChild(vantaScript);

          // Once the Vanta script is loaded, initialize the effect
          vantaScript.onload = () => {
            if (vantaRef.current && !vantaEffect) {
              setVantaEffect(
                window.VANTA.DOTS({
                  el: vantaRef.current,
                  THREE: window.THREE, // Explicitly pass the THREE object
                  mouseControls: true,
                  touchControls: true,
                  gyroControls: false,
                  minHeight: 200.00,
                  minWidth: 200.00,
                  scale: 1.00,
                  scaleMobile: 1.00,
                  color: 0x4f46e5, // A nice indigo color
                  color2: 0x22d3ee, // A nice cyan color
                  backgroundColor: 0x020617, // A very dark blue/slate
                  size: 3.50,
                  spacing: 35.00
                })
              );
            }
          };
        }}
      />
    </>
  );
};

export default VantaDotsBackground;