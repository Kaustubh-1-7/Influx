// File: app/loading.js

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// You can keep your ScrambleText component as is
const ScrambleText = ({ finalText }) => {
  const CHARS = '!<>-_\\/[]{}—=+*^?#________|~@$%^&*()_+`-=[]{};:\'",.<>?';
  const [text, setText] = useState(finalText);

  useEffect(() => {
    let interval;
    let iteration = 0;
    const scramble = () => {
      iteration += 1 / 3;
      const newText = finalText.split('').map((_, index) => {
        if (index < iteration) return finalText[index];
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join('');
      setText(newText);
      if (iteration >= finalText.length) clearInterval(interval);
    };
    interval = setInterval(scramble, 40);
    return () => clearInterval(interval);
  }, [finalText]);

  return <span>{text}</span>;
};

export default function Loading() {
  return (
    // This div is styled to cover the ENTIRE viewport, regardless of layout
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ y: '-100%' }} // Animate out by sliding up
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      // THE FIX: position: fixed, inset-0, and a high z-index
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      <div className="text-center">
        <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-widest uppercase">
          <ScrambleText finalText="REPUFI" />
        </h1>
      </div>
    </motion.div>
  );
}