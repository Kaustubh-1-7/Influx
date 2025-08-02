// File: app/template.js

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

// Re-using the loading UI component from loading.js for consistency
const ScrambleText = ({ finalText }) => {
  // (Copy the exact same ScrambleText component code from loading.js here)
  const CHARS = '!<>-_\\/[]{}—=+*^?#________';
  const [text, setText] = useState(finalText);
  useEffect(() => {let interval; let iteration = 0; const scramble = () => {iteration += 1 / 3; const newText = finalText.split('').map((_, index) => {if (index < iteration) return finalText[index]; return CHARS[Math.floor(Math.random() * CHARS.length)];}).join(''); setText(newText); if (iteration >= finalText.length) clearInterval(interval);}; interval = setInterval(scramble, 40); return () => clearInterval(interval);}, [finalText]);
  return <span>{text}</span>;
};


const Loader = () => (
  <motion.div
    // This is the loader that will show on EVERY navigation
    initial={{ y: '100%' }}
    animate={{ y: '0%' }}
    exit={{ y: '-100%' }}
    transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
  >
    <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-widest uppercase">
      <ScrambleText finalText="REPUFI" />
    </h1>
  </motion.div>
);

export default function Template({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Start transition on route change
    setIsTransitioning(true);

    // Set a minimum time for the loader to be visible
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 2000); // 1.2 seconds minimum loader time

    return () => clearTimeout(timer);
  }, [pathname]); // Re-run effect when pathname changes

  return (
    <AnimatePresence mode="wait">
      {isTransitioning ? (
        <Loader key="loader" />
      ) : (
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}