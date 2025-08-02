// app/admin/challenges/page.jsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import {
    REPUFI_SBT_CONTRACT_ADDRESS,
    REPUFI_SBT_ABI
} from '../../../../lib/constants'; // Adjust path
import { Button } from '../../components/ui/Button'; // Adjust path
import { Loader2, Check, X, ShieldX, ListChecks, Inbox, UserCircle, FileText, CalendarDays, MessageSquare, Tag, AlertOctagon, Hourglass } from 'lucide-react';
import { formatEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Helper to map ChallengeStatus enum (number) to string
const getChallengeStatusString = (statusNumber) => {
    // Assuming enum ChallengeStatus { Pending, Accepted, Rejected }
    if (statusNumber === 0 || statusNumber === BigInt(0)) return "Pending";
    if (statusNumber === 1 || statusNumber === BigInt(1)) return "Accepted";
    if (statusNumber === 2 || statusNumber === BigInt(2)) return "Rejected";
    return "Unknown";
};

export default function AdminChallengesPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const publicClient = usePublicClient();

    const [isAdmin, setIsAdmin] = useState(false);
    const [challenges, setChallenges] = useState([]);
    const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
    const [errorChallenges, setErrorChallenges] = useState(null);

    const [actionChallengeId, setActionChallengeId] = useState(null);
    const [actionMessage, setActionMessage] = useState(null);
    const [actionError, setActionError] = useState(null);

    const { data: contractOwner, isLoading: isLoadingOwner } = useReadContract({
        address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
        functionName: 'owner', query: { enabled: isConnected }
    });

    useEffect(() => {
        if (isConnected && connectedAddress && contractOwner) {
            setIsAdmin(connectedAddress.toLowerCase() === contractOwner.toLowerCase());
        } else {
            setIsAdmin(false);
        }
    }, [isConnected, connectedAddress, contractOwner]);

    const { data: challengeCounterData, refetch: refetchChallengeCounter } = useReadContract({
        address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
        functionName: 'challengeCounter', query: { enabled: isAdmin }
    });

    const fetchAllPendingChallenges = useCallback(async () => {
        if (!publicClient || challengeCounterData === undefined || !isAdmin) {
            setChallenges([]); return;
        }
        setIsLoadingChallenges(true); setErrorChallenges(null);
        const totalChallenges = Number(challengeCounterData);
        if (totalChallenges === 0) {
            setChallenges([]); setIsLoadingChallenges(false); return;
        }
        const fetched = [];
        try {
            for (let i = totalChallenges; i >= 1; i--) { // Fetch newest first
                 if (fetched.length >= 30 && i < totalChallenges - 60) break; // Optimization
                try {
                    const rawChallengeArray = await publicClient.readContract({
                        address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
                        functionName: 'challenges', args: [BigInt(i)]
                    });

                    if (!rawChallengeArray || rawChallengeArray.length < 7) {
                        console.warn(`Skipping Challenge ID ${i}: Invalid data structure returned.`);
                        continue;
                    }

                    const [
                        vouchTokenId,   // Index 0
                        challenger,     // Index 1
                        stakedAmount,   // Index 2 (bigint, this is CHALLENGE_STAKE from contract)
                        timestamp,      // Index 3 (bigint)
                        challengeReason,// Index 4
                        status,         // Index 5 (number/bigint for enum)
                        processed       // Index 6 (boolean)
                    ] = rawChallengeArray;

                    // Only show pending (status = 0) and not yet processed challenges
                    if (challenger && challenger !== "0x0000000000000000000000000000000000000000" && !processed && (Number(status) === 0)) {
                        let vouchDetails = null;
                        try {
                            const rawVouchArray = await publicClient.readContract({
                                address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
                                functionName: 'getVouchDetails', args: [vouchTokenId] // vouchTokenId is already BigInt from struct
                            });
                             if (rawVouchArray && rawVouchArray.length >= 6) { // Vouch struct has at least 6 fields before metadataCID
                                vouchDetails = {
                                    backer: rawVouchArray[0],
                                    borrower: rawVouchArray[1],
                                    amount: rawVouchArray[2], // BigInt
                                    // ... other fields if needed for display
                                };
                            }
                        } catch (e) { console.warn(`Could not get vouch details for VouchTokenID ${vouchTokenId} in challenge ${i}`); }

                        fetched.push({
                            id: i, vouchTokenId, challenger, stakedAmount, timestamp, challengeReason, status, processed, vouchDetails
                        });
                    }
                } catch (e) { console.warn(`Could not fetch challenge ID ${i}:`, e.message); }
            }
            setChallenges(fetched);
        } catch (err) { setErrorChallenges(`Failed to load challenges: ${err.message}`);
        } finally { setIsLoadingChallenges(false); }
    }, [publicClient, challengeCounterData, isAdmin, REPUFI_SBT_ABI, REPUFI_SBT_CONTRACT_ADDRESS]);

    useEffect(() => {
        if (isAdmin && challengeCounterData !== undefined) {
            fetchAllPendingChallenges();
        }
    }, [isAdmin, challengeCounterData, fetchAllPendingChallenges]);

    const { data: processHash, writeContract: executeProcessChallenge, reset: resetProcessContract, isPending: isProcessing, error: processWriteError } = useWriteContract();
    const { isLoading: isConfirmingProcess, isSuccess: isProcessConfirmed, error: processReceiptError } = useWaitForTransactionReceipt({ hash: processHash });

    const handleProcessChallenge = (challengeId, accept) => {
        setActionChallengeId(challengeId); setActionMessage(null); setActionError(null);
        resetProcessContract();
        console.log(`Admin processing Challenge ID: ${challengeId}, Accept: ${accept}`);
        executeProcessChallenge({
            address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
            functionName: 'processChallenge', args: [BigInt(challengeId), accept]
        });
    };

    useEffect(() => {
        if(isProcessing && actionChallengeId) setActionMessage(`Processing Challenge #${actionChallengeId}...`);
        if (isProcessConfirmed && actionChallengeId) {
          setActionMessage(`Challenge #${actionChallengeId} processed! Refreshing list...`);
          refetchChallengeCounter().then(() => fetchAllPendingChallenges());
          setTimeout(() => { setActionMessage(null); setActionChallengeId(null); }, 4000);
        }
        if(processWriteError && actionChallengeId) setActionError(`Tx Error for #${actionChallengeId}: ${processWriteError.shortMessage || processWriteError.message}`);
        if(processReceiptError && actionChallengeId) setActionError(`Confirm Error for #${actionChallengeId}: ${processReceiptError.shortMessage || processReceiptError.message}`);
      }, [isProcessConfirmed, processWriteError, processReceiptError, actionChallengeId, fetchAllPendingChallenges, refetchChallengeCounter, isProcessing]);


    if (!isConnected) return ( <div className="card p-8 text-center max-w-md mx-auto my-10"><LockKeyhole className="h-16 w-16 mx-auto text-primary opacity-70 mb-6" /><h2 className="text-2xl font-semibold mb-3">Connect Wallet</h2><p className="text-slate-600 dark:text-slate-400 mb-6">Please connect an admin wallet.</p><div className="flex justify-center"><ConnectButton /></div></div>);
    if (isLoadingOwner) return <div className="card p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/> Loading admin status...</div>;
    if (!isAdmin) return ( <div className="card p-8 text-center max-w-md mx-auto my-10"><ShieldX className="mx-auto h-16 w-16 text-red-500 mb-6 opacity-70"/><h2 className="text-2xl font-semibold text-foreground mb-3">Access Denied</h2><p className="text-slate-600 dark:text-slate-400">This area is for contract administrators only.</p></div>);

    return (
        <div className="space-y-8 pb-12">
            <header className="text-center pt-4">
                <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2 flex items-center justify-center gap-3">
                    <ListChecks className="h-10 w-10 text-indigo-500"/> Admin: Process Challenges
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-300">Review and process pending challenges to vouches.</p>
            </header>

            <div className="flex justify-end mb-4">
                <Button onClick={fetchAllPendingChallenges} disabled={isLoadingChallenges} className="btn-outline text-sm">
                    {isLoadingChallenges ? <Loader2 className="h-4 w-4 animate-spin"/> : "Refresh Pending Challenges"}
                </Button>
            </div>

            {actionMessage && <p className="mb-4 text-center text-green-500 dark:text-green-400 p-3 bg-green-50 dark:bg-green-700/20 rounded-md animate-fadeIn">{actionMessage}</p>}
            {actionError && <p className="mb-4 text-center text-red-500 dark:text-red-400 p-3 bg-red-50 dark:bg-red-700/20 rounded-md animate-fadeIn">{actionError}</p>}
            {errorChallenges && <p className="mb-4 text-center text-red-500 dark:text-red-400 p-3 bg-red-50 dark:bg-red-700/20 rounded-md animate-fadeIn">{errorChallenges}</p>}

            {isLoadingChallenges && <div className="text-center py-10"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary"/><p className="mt-2">Loading pending challenges...</p></div>}

            {!isLoadingChallenges && challenges.length === 0 && !errorChallenges && (
                <div className="card p-8 text-center">
                    <Inbox className="h-16 w-16 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Pending Challenges</h3>
                    <p className="text-slate-500 dark:text-slate-400">All challenges have been processed, or no new challenges have been submitted.</p>
                </div>
            )}

            {challenges.length > 0 && (
                <div className="space-y-6">
                    {challenges.map(chal => (
                        <div key={chal.id} className="card p-5 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">Challenge ID: #{chal.id}</h3>
                                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 flex items-center gap-1">
                                    <Hourglass size={12}/> {getChallengeStatusString(Number(chal.status))}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
                                <p className="flex items-center gap-2"><Tag size={16} className="text-slate-500"/><strong>Vouch Token ID:</strong> {chal.vouchTokenId.toString()}</p>
                                <p className="flex items-center gap-2"><UserCircle size={16} className="text-slate-500"/><strong>Challenger:</strong> <span className="font-mono text-xs block truncate">{chal.challenger}</span></p>
                                <p className="flex items-center gap-2"><FileText size={16} className="text-slate-500"/><strong>Challenger's Stake:</strong> {formatEther(BigInt(chal.stakedAmount ?? 0))} PAS</p>
                                <p className="flex items-center gap-2"><CalendarDays size={16} className="text-slate-500"/><strong>Challenged At:</strong> {new Date(Number(chal.timestamp) * 1000).toLocaleString()}</p>
                            </div>
                             <div className="mb-3">
                                <p className="font-medium text-sm mb-1 flex items-center gap-2"><MessageSquare size={16} className="text-slate-500"/>Challenge Reason:</p>
                                <p className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded text-sm max-h-28 overflow-y-auto border border-border">{chal.challengeReason}</p>
                            </div>

                            {chal.vouchDetails && (
                                <div className="mb-4 pt-3 border-t border-border text-xs text-slate-500 dark:text-slate-400">
                                    <p className="font-medium mb-1">Original Vouch Being Challenged:</p>
                                    <p>Backer: <span className="font-mono">{chal.vouchDetails.backer}</span></p>
                                    <p>Borrower: <span className="font-mono">{chal.vouchDetails.borrower}</span></p>
                                    <p>Vouch Amount: {formatEther(BigInt(chal.vouchDetails.amount ?? 0))} PAS</p>
                                </div>
                            )}
                            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={() => handleProcessChallenge(chal.id, true)} // true for accept
                                    className="btn-primary bg-green-500 hover:bg-green-600 flex-1 py-2.5"
                                    disabled={isProcessing || isConfirmingProcess}
                                >
                                    {(isProcessing || isConfirmingProcess) && actionChallengeId === chal.id ? <Loader2 className="h-5 w-5 animate-spin"/> : <Check size={18}/>}
                                    Accept Challenge
                                </Button>
                                <Button
                                    onClick={() => handleProcessChallenge(chal.id, false)} // false for reject
                                    className="btn-danger flex-1 py-2.5"
                                    disabled={isProcessing || isConfirmingProcess}
                                >
                                     {(isProcessing || isConfirmingProcess) && actionChallengeId === chal.id ? <Loader2 className="h-5 w-5 animate-spin"/> : <X size={18}/>}
                                    Reject Challenge
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}