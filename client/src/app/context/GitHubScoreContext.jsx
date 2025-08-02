// app/context/GitHubScoreContext.jsx
'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { getGitHubData as getStoredGitHubData, storeGitHubData as storeStoredGitHubData, clearGitHubData as clearStoredGitHubData } from '../../../lib/localStorageHelper'; // Adjust path

const GitHubScoreContext = createContext(null);

export const useGitHubScore = () => useContext(GitHubScoreContext);

export const GitHubScoreProvider = ({ children }) => {
  const { data: session, status: sessionStatus } = useSession();
  const { address: connectedAddress, isConnected: isWalletConnected } = useAccount();

  const [scoreData, setScoreData] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const fetchScore = useCallback(async (username, forceRefresh = false) => {
    if (!username) {
      setScoreData(null);
      return null;
    }
    setIsFetching(true);
    setError(null);

    if (!forceRefresh && connectedAddress) {
      const storedData = getStoredGitHubData(connectedAddress);
      if (storedData && storedData.username?.toLowerCase() === username.toLowerCase()) {
        setScoreData(storedData);
        setIsFetching(false);
        return storedData;
      }
    }

    try {
      const response = await fetch("/api/github-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch score.");
      setScoreData(data);
      if (connectedAddress) storeStoredGitHubData(connectedAddress, data);
      return data;
    } catch (err) {
      setError(err.message);
      setScoreData(null);
      return null;
    } finally {
      setIsFetching(false);
    }
  }, [connectedAddress]);

  // Effect to fetch score when session or wallet changes
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.githubUsername) {
      fetchScore(session.user.githubUsername);
    } else if (sessionStatus !== 'loading' && isWalletConnected && connectedAddress) {
      const storedData = getStoredGitHubData(connectedAddress);
      if (storedData) setScoreData(storedData);
      else setScoreData(null);
    } else {
      setScoreData(null); // Clear score if no session and no wallet
    }
  }, [sessionStatus, session, isWalletConnected, connectedAddress, fetchScore]);

  // Effect to clear score from storage on GitHub sign out AND wallet disconnect
  const prevSessionStatus = React.useRef(sessionStatus);
  const prevWalletConnected = React.useRef(isWalletConnected);

  useEffect(() => {
    if (
        (prevSessionStatus.current === 'authenticated' && sessionStatus === 'unauthenticated') ||
        (prevWalletConnected.current && !isWalletConnected)
       ) {
      if (connectedAddress) clearStoredGitHubData(connectedAddress); // Clear for current or last wallet
      setScoreData(null);
    }
    prevSessionStatus.current = sessionStatus;
    prevWalletConnected.current = isWalletConnected;
  }, [sessionStatus, isWalletConnected, connectedAddress]);


  const contextValue = {
    scoreData,
    isFetchingScore: isFetching,
    fetchScoreError: error,
    refreshScore: (username) => fetchScore(username || session?.user?.githubUsername || scoreData?.username, true),
    clearScore: () => {
        if(connectedAddress) clearStoredGitHubData(connectedAddress);
        setScoreData(null);
    }
  };

  return (
    <GitHubScoreContext.Provider value={contextValue}>
      {children}
    </GitHubScoreContext.Provider>
  );
};