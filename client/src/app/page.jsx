import { Github, ShieldCheck, Rocket } from "lucide-react"
import VantaBackground from "./components/VantaBackground" // 1. Import the component
import { TypewriterEffect } from "./components/ui/typewriter-effect"

export default function LandingPage() {
  const words = [
    {
      text: "A",
    },
    {
      text: "Simple,",
    },
    {
      text: "Powerful",
      className: "text-primary",
    },
    {
      text: "Flow",
      className: "text-primary",
    },
  ]

  return (
    <>
      {/* 2. Add the Vanta component here. It will automatically be the background. */}
      <VantaBackground />

      {/* 3. Wrap your page content in a container with 'relative' and 'z-10' to lift it above the background */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ======================================================= */}
        {/* The Polished Hero Section                             */}
        {/* ======================================================= */}
        <section className="relative py-24 md:py-40 text-center">
          {/* 4. REMOVE the old Glassmorphism background element. Vanta replaces it. */}
          {/* <div aria-hidden="true" className="absolute ..."> ... </div> */}

          {/* Headline - Added text-white to make it visible */}
          <h1 className="text-5xl font-extrabold tracking-tighter text-white sm:text-6xl md:text-7xl">
            Turn Your Reputation
            <br />
            <span className="bg-gradient-to-br from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Into On-Chain Trust.
            </span>
          </h1>

          {/* Sub-headline - Changed color for better contrast */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 md:text-xl">
            RepuFi transforms your proven GitHub history into a verifiable asset, allowing you to back developers and
            build a new layer of trust for Web3.
          </p>

          {/* Call to Action Button (no changes needed) */}
          {/* <div className="mt-10 flex items-center justify-center">
            <Link href="/become-backer">
              <button className="btn btn-primary !text-lg !font-semibold !px-8 !py-3 transform transition-transform hover:scale-105 shadow-lg shadow-primary/20 hover:shadow-primary/30">
                Become a Backer
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </Link>
          </div> */}
        </section>

        {/* ======================================================= */}
        {/* Features & How-It-Works Sections                     */}
        {/* ======================================================= */}
        <div className="space-y-24 md:space-y-32 py-16">
          {/* Features Section */}
          <section>
            {/* 5. UPDATED cards to have a background for readability on top of the globe */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="card p-8 text-center bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl transition-transform hover:-translate-y-2">
                <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
                  <Github className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Analyze & Score</h3>
                <p className="text-slate-400">
                  Login and let our system calculate your Developer Reputation Score (DRS) based on your public
                  contributions.
                </p>
              </div>
              <div className="card p-8 text-center bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl transition-transform hover:-translate-y-2">
                <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Vouch & Stake</h3>
                <p className="text-slate-400">
                  Use your high score to back developers you trust by staking collateral and minting a Vouch SBT
                  on-chain.
                </p>
              </div>
              <div className="card p-8 text-center bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl transition-transform hover:-translate-y-2">
                <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
                  <Rocket className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Empower & Grow</h3>
                <p className="text-slate-400">
                  Help talented builders access opportunities and strengthen the ecosystem while building your on-chain
                  credibility.
                </p>
              </div>
            </div>
          </section>

          {/* How It Works Section - Update text colors for contrast */}
          <section className="text-center">
            <div className="mb-4">
              <TypewriterEffect words={words} className="text-white" />
            </div>
            <p className="text-lg text-slate-300 mb-12 max-w-2xl mx-auto">
              Follow these steps to become an active participant in the RepuFi network.
            </p>
            {/* The rest of this section also needs text color updates */}
          </section>
        </div>
      </div>
    </>
  )
}
