// app/(components)/GitHubAnalyzerClient.jsx
'use client';
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Loader2, Github, /* ... other icons ... */ RefreshCw } from 'lucide-react';
import { storeGitHubData, getGitHubData, clearGitHubData } from '../../../lib/localStorageHelper';
import { useAccount } from 'wagmi';
import { useSession } from 'next-auth/react'; // <--- IMPORT useSession
import Link from 'next/link';
const MIN_GITHUB_SCORE_CONTRACT = 7;

// ProgressBar component (same 
const ProgressBar = ({ value, className = "" }) => (
  <div className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 ${className}`}>
    <div
      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    ></div>
  </div>
);

export default function GitHubAnalyzerClient({ onAnalysisComplete }) {
  const { address: connectedAddress } = useAccount();
  const { data: session, status: sessionStatus } = useSession(); // <--- USE SESSION

  const [usernameToAnalyze, setUsernameToAnalyze] = useState(""); // This can be pre-filled or input
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [error, setError] = useState("");
  const [showForceRefresh, setShowForceRefresh] = useState(false);
  const [isAutoAnalyzed, setIsAutoAnalyzed] = useState(false); // Flag to prevent re-auto-analyzing

  // Function to trigger analysis
  const analyzeProfile = useCallback(async (ghUsername, forceRefresh = false) => {
    if (!ghUsername || !ghUsername.trim()) {
      setError("GitHub username is required to analyze.");
      if (onAnalysisComplete) onAnalysisComplete(null);
      return;
    }

    // Check local storage first if not forcing refresh
    if (!forceRefresh && connectedAddress) {
        const storedData = getGitHubData(connectedAddress);
        if (storedData && storedData.username?.toLowerCase() === ghUsername.trim().toLowerCase()) {
            setScoreData(storedData);
            setUsernameToAnalyze(storedData.username); // Ensure input field matches
            if (onAnalysisComplete) onAnalysisComplete(storedData);
            setShowForceRefresh(true);
            return; // Use cached data
        }
    }

    setLoading(true);
    setError("");
    // Don't clear scoreData here if we want to show old score while new one loads
    // setScoreData(null);

    try {
      const response = await fetch("/api/github-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ghUsername.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze profile.");
      }
      setScoreData(data);
      if (connectedAddress) {
        storeGitHubData(connectedAddress, data);
      }
      if (onAnalysisComplete) {
        onAnalysisComplete(data);
      }
      setShowForceRefresh(true);
    } catch (err) {
      setError(err.message);
      setScoreData(null); // Clear score on error
      if (onAnalysisComplete) onAnalysisComplete(null);
    } finally {
      setLoading(false);
    }
  }, [connectedAddress, onAnalysisComplete]); // Add dependencies for useCallback

  // Effect to auto-analyze when session is available or connectedAddress changes
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.githubUsername && !isAutoAnalyzed) {
      const ghUsernameFromSession = session.user.githubUsername;
      setUsernameToAnalyze(ghUsernameFromSession); // Pre-fill input
      analyzeProfile(ghUsernameFromSession); // Analyze automatically
      setIsAutoAnalyzed(true); // Prevent re-analyzing on every render
    } else if (sessionStatus !== 'loading' && !isAutoAnalyzed && connectedAddress) {
      // If not authenticated via GitHub but wallet is connected, check localStorage
      const storedData = getGitHubData(connectedAddress);
      if (storedData && storedData.username) {
        setUsernameToAnalyze(storedData.username);
        setScoreData(storedData);
        if (onAnalysisComplete) onAnalysisComplete(storedData);
        setShowForceRefresh(true);
        setIsAutoAnalyzed(true);
      }
    } else if (sessionStatus === 'unauthenticated') {
      // If user logs out of GitHub, clear auto-analyzed state
      // but keep localStorage data if wallet is still connected.
      setIsAutoAnalyzed(false);
      // Optionally clear usernameToAnalyze if you want the field to empty on GitHub logout
      // setUsernameToAnalyze("");
    }
  }, [sessionStatus, session, analyzeProfile, onAnalysisComplete, connectedAddress, isAutoAnalyzed]);

  const handleManualAnalyze = () => {
     setIsAutoAnalyzed(true); // Treat manual analysis as if it was "auto" for the purpose of not re-triggering
     analyzeProfile(usernameToAnalyze);
  }

  const handleClearAndRefresh = () => {
     if (connectedAddress) {
         clearGitHubData(connectedAddress);
     }
     setScoreData(null);
     setShowForceRefresh(false);
     if (onAnalysisComplete) onAnalysisComplete(null);
     analyzeProfile(usernameToAnalyze, true); // Force a new analysis with current username
  }


  const getScoreColorClass = (scoreVal) => { /* ... same as before ... */ };

  // Don't render input if session is loading and we don't have a username yet
  // if (sessionStatus === 'loading' && !usernameToAnalyze) {
  //   return <div className="card p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> <p>Loading user session...</p></div>;
  // }

  return (
    <div className="card p-6 animate-fadeIn">
      {/* ... Card Header ... */}
      <div className="flex flex-col sm:flex-row gap-3 mb-1">
        <Input
          type="text"
          placeholder="Enter GitHub username or login"
          value={usernameToAnalyze}
          onChange={(e) => {
             setUsernameToAnalyze(e.target.value);
             setShowForceRefresh(false); // Hide refresh if username changes from analyzed one
             setIsAutoAnalyzed(true); // User is now manually controlling
          }}
          onKeyPress={(e) => e.key === "Enter" && !loading && handleManualAnalyze()}
          className="flex-grow"
          aria-label="GitHub Username"
          disabled={loading || (sessionStatus === 'authenticated' && !!session?.user?.githubUsername)} // Disable if logged in and username is from session
        />
        <Button onClick={handleManualAnalyze} disabled={loading || !usernameToAnalyze.trim()} className="w-full sm:w-auto btn-primary">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-4 w-4" />}
          {loading ? "Analyzing..." : (scoreData && scoreData.username?.toLowerCase() === usernameToAnalyze.trim().toLowerCase()) ? "Re-Analyze" : "Analyze Profile"}
        </Button>
      </div>
      {showForceRefresh && scoreData && (
         <div className="text-center mb-4">
             <Button onClick={handleClearAndRefresh} variant="link" className="text-xs text-primary p-0 h-auto hover:underline" disabled={loading}>
                 <RefreshCw size={12} className="mr-1"/> Force refresh score for '{scoreData.username}'
             </Button>
         </div>
      )}
      {error && <p className="text-red-500 text-sm text-center mb-4 animate-fadeIn">{error}</p>}

      {/* ... Score Display logic (same as before, using scoreData) ... */}
      {scoreData && (
         <div className="animate-fadeIn space-y-6 mt-6">
             {/* ... score display ... */}
         </div>
      )}
    </div>
  );
}