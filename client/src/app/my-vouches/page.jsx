// app/my-vouches/page.jsx
'use client'; 
import MyVouchesClient from "../components/MyVouchesClient";
// 1. Import the new Vanta component
import VantaDotsBackground from '../components/VantaDotsBackground'; 

export default function MyVouchesPage() {
  return (
    // The main wrapper can be simpler now
    <div className="relative min-h-screen text-white">
      {/* 2. Replace BackgroundAurora with your new Vanta component */}
      <VantaDotsBackground />

      {/* This part is already perfect, as it uses z-10 to stay on top */}
      <main className="relative z-10 p-6 sm:p-8 md:p-12">
        <MyVouchesClient />
      </main>
    </div>
  );
}