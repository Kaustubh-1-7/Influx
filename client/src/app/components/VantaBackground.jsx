// src/components/VantaBackground.jsx
"use client"; // This is the most important line.

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three'; // Import THREE
import GLOBE from 'vanta/dist/vanta.globe.min.js';

const VantaBackground = () => {
  const [vantaEffect, setVantaEffect] = useState(null);
  const vantaRef = useRef(null);

  useEffect(() => {
    // Initialize Vanta effect only if it hasn't been created yet
    if (!vantaEffect && vantaRef.current) {
      setVantaEffect(
        GLOBE({
          el: vantaRef.current,
          THREE: THREE, // Pass the THREE object to Vanta
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: 1.00,
          scaleMobile: 1.00,
          color: 0x3b82f6,      // A nice blue from the Tailwind `blue-500`
          backgroundColor: 0x020617, // A very dark blue, like Tailwind `slate-950`
        })
      );
    }

    // This is the cleanup function. It will be called when the component unmounts.
    return () => {
      if (vantaEffect) {
        vantaEffect.destroy();
      }
    };
  }, [vantaEffect]); // The effect depends on `vantaEffect` state

  return (
    <div
      ref={vantaRef}
      style={{
        position: 'fixed', // Stick to the viewport
        top: 0,
        left: 0,
        width: '100vw',    // Cover full viewport width
        height: '100vh',   // Cover full viewport height
        zIndex: -1,        // Place it behind all other content
      }}
    />
  );
};

export default VantaBackground;