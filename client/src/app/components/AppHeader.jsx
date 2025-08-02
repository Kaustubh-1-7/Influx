// app/(components)/AppHeader.jsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { Sun, Moon, ShieldCheck, Github, LogOut, Handshake, Users, UserPlus, ShieldQuestion, UserCog, BarChart3, Info, Loader2, Menu, X, Wallet, ChevronDown } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { REPUFI_SBT_CONTRACT_ADDRESS, REPUFI_SBT_ABI } from '../../../lib/constants';
import { useGitHubScore } from '../context/GitHubScoreContext';

// --- Reusable UI Components (can be moved to their own files) ---

const Tooltip = ({ content, children, position = "bottom" }) => {
  const [show, setShow] = useState(false);
  const positionClasses = {
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  };
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && content && (
        <div className={`absolute ${positionClasses[position]} w-max max-w-xs p-2 text-xs font-semibold text-white bg-slate-800 dark:bg-slate-950 rounded-md shadow-lg z-[100] pointer-events-none opacity-95 animate-fadeIn`} role="tooltip">
          {content}
        </div>
      )}
    </div>
  );
};

// --- Main Header Component ---

export default function AppHeader() {
  const { scoreData, isFetchingScore, fetchScoreError, refreshScore, clearScore } = useGitHubScore();
  const { theme, setTheme } = useTheme();
  const { address: connectedAddress, isConnected: isWalletConnected } = useAccount();
  const { data: session, status: sessionStatus } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const { data: contractOwner } = useReadContract({
    address: REPUFI_SBT_CONTRACT_ADDRESS,
    abi: REPUFI_SBT_ABI,
    functionName: 'owner',
    enabled: isWalletConnected,
  });
  const isAdmin = isWalletConnected && connectedAddress && contractOwner && connectedAddress.toLowerCase() === contractOwner.toLowerCase();

  const navLinks = [
    { href: "/explore", label: "Explore", icon: Handshake },
    { href: "/become-backer", label: "Become Backer", icon: Users },
    { href: "/request-reputation", label: "Request Vouch", icon: UserPlus },
    { href: "/my-vouches", label: "My Vouches", icon: Info },
    ...(isAdmin ? [{ href: "/admin/challenges", label: "Admin", icon: UserCog, className: "text-orange-500 hover:text-orange-600 dark:hover:text-orange-400" }] : []),
  ];

  // --- Header Sub-Components ---

  // AuthButton from v1 with the red logout icon, adapted for v2's structure
  const AuthButton = () => {
    if (sessionStatus === "loading") {
      return <div className="p-2 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse w-28 h-9"></div>;
    }
    if (session) {
      return (
        <div className="flex items-center gap-2">
            {session.user.image && (
                <img src={session.user.image} alt="User" className="h-8 w-8 rounded-full border-2 border-slate-300 dark:border-slate-600" />
            )}
            <span className="text-sm font-semibold hidden sm:inline">{session.user.name || session.user.githubUsername}</span>
            <Tooltip content="Sign Out">
              <button
                  onClick={() => {
                    signOut(); // NextAuth signout
                    clearScore(); // Clear GitHub score from context & localStorage
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                  <LogOut className="h-5 w-5 text-red-500" />
              </button>
            </Tooltip>
        </div>
      );
    }
    return (
        <button
            onClick={() => signIn('github')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-950 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg transition-all shadow-sm hover:shadow-md"
        >
            <Github className="h-5 w-5"/>
            <span>Login</span>
        </button>
    );
  };

  // GitHubScoreDisplay with styling from screenshot 1
  const GitHubScoreDisplay = () => {
    if (!session || sessionStatus !== 'authenticated' || !mounted) return null;
    if (isFetchingScore) return <div className="flex items-center text-xs text-slate-500 dark:text-slate-400"><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Checking...</div>;
    if (fetchScoreError) return <Tooltip content={`Error: ${fetchScoreError}. Click to retry.`}><button onClick={refreshScore} className="flex items-center text-xs text-red-500"><Info className="h-4 w-4 mr-1.5" /> Score Error</button></Tooltip>;
    
    if (scoreData?.totalScore !== undefined) {
      const scoreBreakdownContent = (
        <div className="space-y-1.5 text-left text-sm p-1">
          <p className="font-bold text-center mb-1.5 border-b border-slate-600 pb-1.5">Score Details ({scoreData.username})</p>
          {scoreData.breakdown && Object.entries(scoreData.breakdown).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center gap-4">
              <span className="capitalize text-slate-300">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
              <span className="font-mono font-bold text-white">{value?.toFixed ? value.toFixed(1) : value}/10</span>
            </div>
          ))}

        </div>
      );
      return (
        <Tooltip content={scoreBreakdownContent} position="bottom">
          {/* This div is styled to match the first screenshot's score pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#042f2e] text-green-400 font-bold text-sm cursor-pointer border border-green-800/60 hover:bg-green-900/70 transition-colors">
            <BarChart3 className="h-4 w-4 text-green-500" />
            <span>Score: {scoreData.totalScore.toFixed(1)}</span>
          </div>
        </Tooltip>
      );
    }
    return null;
  };

  // CustomConnectButton from v2, which matches screenshot 2
  const CustomConnectButton = () => (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');
        
        if (!ready) return <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse w-48 h-10"></div>;
        if (!connected) return <button onClick={openConnectModal} type="button" className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm hover:shadow-md"><Wallet className="h-5 w-5" />Connect Wallet</button>;
        if (chain.unsupported) return <button onClick={openChainModal} type="button" className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition-all border border-red-500/30 hover:bg-red-500/20"><Info className="h-5 w-5" />Wrong Network</button>;

        return (
          <div className="flex items-center bg-background border border-border/60 rounded-lg shadow-sm">
            <button onClick={openChainModal} type="button" className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-l-md hover:bg-accent transition-colors">
              {chain.hasIcon && chain.iconUrl ?
                <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} className="w-6 h-6 rounded-full" />
                : <div className='w-6 h-6 rounded-full bg-slate-700'></div>
              }
              <span className="font-sans text-sm font-medium text-foreground/80 hidden md:inline-block">{chain.name}</span>
              <ChevronDown className="h-4 w-4 text-slate-500 ml-1" />
            </button>
            <div className="w-px h-6 bg-border/60"></div>
            <Tooltip content="Account options" position="bottom">
              <button onClick={openAccountModal} type="button" className="flex items-center p-2 rounded-r-md hover:bg-accent transition-colors">
                {account.ensAvatar ? 
                  <img src={account.ensAvatar} alt="ENS Avatar" className="h-6 w-6 rounded-full" />
                  : <div className="w-6 h-6 rounded-full bg-pink-200 flex items-center justify-center text-sm">🐷</div>
                }
                <ChevronDown className="h-4 w-4 text-slate-500 ml-1" />
              </button>
            </Tooltip>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2"><ShieldCheck className="h-7 w-7 text-primary" /><span className="hidden font-bold sm:inline-block text-xl">Influx</span></Link>
            <nav className="flex items-center gap-4 text-sm lg:gap-6">
              {navLinks.map((link) => <Link key={link.href} href={link.href} className={`transition-colors hover:text-foreground/80 flex items-center gap-1.5 ${pathname === link.href ? 'text-foreground' : 'text-foreground/60'} ${link.className || ''}`}><link.icon size={16} />{link.label}</Link>)}
            </nav>
          </div>

          <div className="flex items-center md:hidden">
            <button className="mr-2 inline-flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-accent-foreground" onClick={() => setIsMenuOpen(!isMenuOpen)}><span className="sr-only">Open main menu</span>{isMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}</button>
            <Link href="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}><ShieldCheck className="h-7 w-7 text-primary" /><span className="font-bold">RepuFi</span></Link>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-2 sm:space-x-4">
            <div className="hidden sm:flex items-center gap-3">{mounted && <AuthButton />}<GitHubScoreDisplay /></div>
            <CustomConnectButton />
            {/* {mounted && <Tooltip content={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} position="bottom"><button onClick={toggleTheme} className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Toggle theme">{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button></Tooltip>} */}
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 md:hidden animate-fadeIn" onClick={() => setIsMenuOpen(false)}>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm"></div>
          <nav className="fixed left-0 top-16 h-full w-4/5 max-w-sm bg-background border-r border-border/40 p-6 space-y-4">
            {navLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 rounded-lg p-3 text-lg font-medium transition-colors hover:bg-accent ${pathname === link.href ? 'bg-accent' : 'text-foreground/70'} ${link.className || ''}`}><link.icon size={20} />{link.label}</Link>)}
            <div className="pt-6 border-t border-border/40 space-y-4">
              <div className="sm:hidden flex flex-col items-start gap-4"><AuthButton /><GitHubScoreDisplay /></div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}