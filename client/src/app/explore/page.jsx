// app/explore-vouches/page.jsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import {
    REPUFI_SBT_CONTRACT_ADDRESS,
    REPUFI_SBT_ABI,
    CHALLENGE_STAKE_ETH_STRING,
    displayChallengeStake
} from '../../../lib/constants';
import { fetchFromIPFS } from '../../../lib/ipfsHelper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Loader2, ExternalLink , ShieldQuestion, LockKeyhole, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import VantaDotsBackground from '../components/VantaDotsBackground'; // 1. IMPORT THE BACKGROUND

// Updated Modal for better look on the new background
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn" onClick={onClose}>
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 text-slate-100 p-6 rounded-2xl shadow-2xl max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-3 mb-4">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="p-1 h-auto bg-transparent hover:bg-slate-700 rounded-full text-slate-400 hover:text-white text-2xl leading-none">×</button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default function ExploreVouchesPage() {
    const { address: connectedAddress, isConnected } = useAccount();
    const publicClient = usePublicClient();

    const [allVouches, setAllVouches] = useState([]);
    const [isLoadingVouches, setIsLoadingVouches] = useState(false);
    const [errorVouches, setErrorVouches] = useState(null);

    const [challengeModalOpen, setChallengeModalOpen] = useState(false);
    const [vouchToChallenge, setVouchToChallenge] = useState(null);
    const [challengeReason, setChallengeReason] = useState('');

    const {
        data: challengeHash,
        writeContract: executeCreateChallenge,
        reset: resetChallengeContract,
        isPending: isChallengePending,
        error: challengeWriteError
    } = useWriteContract();

    const {
        isLoading: isChallengeConfirming,
        isSuccess: isChallengeConfirmed,
        error: challengeReceiptError
    } = useWaitForTransactionReceipt({ hash: challengeHash });

    const [challengeFormMessage, setChallengeFormMessage] = useState(null);
    const [challengeFormError, setChallengeFormError] = useState(null);

    const challengeStakeInWei = parseEther(CHALLENGE_STAKE_ETH_STRING);
    const displayStakeString = displayChallengeStake();

    const { data: vouchTokenIdCounterData } = useReadContract({
        address: REPUFI_SBT_CONTRACT_ADDRESS,
        abi: REPUFI_SBT_ABI,
        functionName: 'tokenIdCounter',
        query: { enabled: isConnected }
    });
    
    // --- Core Logic Functions (Unchanged) ---
    const fetchAllActiveVouches = useCallback(async () => {
        if (!publicClient || vouchTokenIdCounterData === undefined) { setAllVouches([]); return; }
        setIsLoadingVouches(true); setErrorVouches(null);
        const totalSBTs = Number(vouchTokenIdCounterData);
        if (totalSBTs === 0) { setAllVouches([]); setIsLoadingVouches(false); return; }

        const fetchedVouches = [];
        const processedVouchInstances = new Set();
        try {
            for (let i = totalSBTs; i >= 1; i--) {
                if (fetchedVouches.length >= 30 && i < totalSBTs - 60) break;
                if (processedVouchInstances.has(i)) continue;
                try {
                    const rawVouchArray = await publicClient.readContract({
                        address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
                        functionName: 'vouches', args: [BigInt(i)]
                    });
                    if (!rawVouchArray || rawVouchArray.length < 8) { continue; }
                    const [backer, borrower, amount, expiry, withdrawn, pairedTokenId, forceExpired, metadataCID] = rawVouchArray;
                    if (backer && backer !== "0x0000000000000000000000000000000000000000" && !withdrawn && !forceExpired) {
                        let ipfsMetadata = { name: `Vouch (SBT ID: ${i})`, description: "Metadata loading..." };
                        if (metadataCID && typeof metadataCID === 'string' && metadataCID.trim() !== '') {
                            try { ipfsMetadata = await fetchFromIPFS(metadataCID); } catch (e) { console.warn(`IPFS error for Vouch CID ${metadataCID}`, e); }
                        }
                        fetchedVouches.push({ sbtId: i, backer, borrower, amount, expiry: Number(expiry), metadataCID, pairedTokenId: Number(pairedTokenId), metadata: ipfsMetadata });
                        processedVouchInstances.add(i);
                        if (pairedTokenId && Number(pairedTokenId) > 0) { processedVouchInstances.add(Number(pairedTokenId)); }
                    }
                } catch (e) { console.warn(`Could not fetch Vouch ID ${i}:`, e.message); }
            }
            setAllVouches(fetchedVouches);
        } catch (err) { setErrorVouches(`Failed to load vouches: ${err.message}`);
        } finally { setIsLoadingVouches(false); }
    }, [publicClient, vouchTokenIdCounterData]);

    useEffect(() => {
        if (isConnected && vouchTokenIdCounterData !== undefined) { fetchAllActiveVouches(); }
    }, [isConnected, vouchTokenIdCounterData, fetchAllActiveVouches]);
    
    const handleOpenChallengeModal = (vouchSbtId, borrowerAddress, backerAddress) => {
        setVouchToChallenge({ id: vouchSbtId, borrower: borrowerAddress, backer: backerAddress });
        setChallengeReason('');
        setChallengeFormError(null); setChallengeFormMessage(null);
        resetChallengeContract();
        setChallengeModalOpen(true);
    };

    const handleChallengeSubmit = async (e) => {
        e.preventDefault();
        setChallengeFormError(null); setChallengeFormMessage(null); resetChallengeContract();
        if (!vouchToChallenge || !vouchToChallenge.id) { setChallengeFormError("No vouch selected."); return; }
        if (!challengeReason.trim()) { setChallengeFormError('A reason is required.'); return; }
        try {
            setChallengeFormMessage(`Submitting challenge...`);
            executeCreateChallenge({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'createChallenge', args: [BigInt(vouchToChallenge.id), challengeReason], value: challengeStakeInWei, });
        } catch (err) { setChallengeFormError(`Error: ${err.message || 'An error occurred.'}`); setChallengeFormMessage(null); }
    };

    useEffect(() => {
        if (isChallengeConfirmed) {
            setChallengeFormMessage('Challenge submitted successfully!');
            setTimeout(() => { setChallengeModalOpen(false); setChallengeFormMessage(null); setVouchToChallenge(null); }, 3500);
        }
        if (challengeWriteError) { setChallengeFormError(`Tx Error: ${challengeWriteError.shortMessage || challengeWriteError.message}`); setChallengeFormMessage(null); }
        if (challengeReceiptError) { setChallengeFormError(`Confirm Error: ${challengeReceiptError.shortMessage || challengeReceiptError.message}`); setChallengeFormMessage(null); }
    }, [isChallengeConfirmed, challengeWriteError, challengeReceiptError]);
    
    if (!isConnected) {
        return (
            <div className="relative min-h-screen text-white">
                <VantaDotsBackground /> {/* Vanta background for the "Connect Wallet" screen */}
                <main className="relative z-10 p-6 sm:p-8 md:p-12 flex items-center justify-center h-full">
                    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-xl p-8 text-center max-w-md mx-auto animate-fadeIn">
                        <LockKeyhole className="h-16 w-16 mx-auto text-indigo-400 opacity-70 mb-6" />
                        <h2 className="text-2xl font-semibold text-white mb-3">Connect Your Wallet</h2>
                        <p className="text-slate-300 mb-6">Please connect your wallet to explore and challenge vouches.</p>
                        <div className="flex justify-center"><ConnectButton /></div>
                    </div>
                </main>
            </div>
        );
    }
    
    const cardBaseStyle = "bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-xl flex flex-col justify-between hover:shadow-2xl hover:border-slate-600 transition-all duration-300";

    return (
    // 2. MAIN PAGE WRAPPER WITH VANTA BACKGROUND
    <div className="relative min-h-screen text-white">
      <VantaDotsBackground />
      <main className="relative z-10 p-6 sm:p-8 md:p-12 space-y-10 pb-12">
        <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Explore Active Vouches</h1>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
            Browse vouches made on RepuFi. You can challenge a vouch if you believe it's invalid.
            </p>
        </header>

        <div className="flex justify-end mb-4 max-w-7xl mx-auto px-4">
            <Button onClick={fetchAllActiveVouches} disabled={isLoadingVouches} className="btn-outline text-sm">
                {isLoadingVouches ? <Loader2 className="h-4 w-4 animate-spin"/> : "Refresh Vouches"}
            </Button>
        </div>

        {isLoadingVouches && <div className="text-center py-10"><Loader2 className="h-12 w-12 animate-spin mx-auto text-indigo-400"/><p className="mt-2 text-slate-200">Loading active vouches...</p></div>}
        {errorVouches && <p className="text-red-400 text-center py-4 bg-red-900/50 border border-red-800 rounded-lg">{errorVouches}</p>}
        {!isLoadingVouches && allVouches.length === 0 && !errorVouches && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-xl p-8 text-center max-w-md mx-auto">
                <Eye size={48} className="mx-auto mb-4 text-indigo-400 opacity-50"/>
                <h3 className="text-xl font-medium text-white mb-2">No Active Vouches Found</h3>
                <p className="text-slate-400">There are currently no active vouches to display.</p>
            </div>
        )}

        {allVouches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {allVouches.map(vouch => {
                    const displayExpiry = vouch.expiry ? new Date(vouch.expiry * 1000).toLocaleDateString() : "N/A";
                    const displayAmount = typeof vouch.amount === 'bigint' ? formatEther(vouch.amount) : "N/A";
                    const isMyVouch = connectedAddress && (vouch.backer?.toLowerCase() === connectedAddress.toLowerCase() || vouch.borrower?.toLowerCase() === connectedAddress.toLowerCase());
                    const shortBacker = `${vouch.backer.substring(0, 6)}...${vouch.backer.substring(vouch.backer.length - 4)}`;
                    const shortBorrower = `${vouch.borrower.substring(0, 6)}...${vouch.borrower.substring(vouch.borrower.length - 4)}`;

                    return (
                        <div key={vouch.sbtId} className={`${cardBaseStyle} p-5 space-y-4`}>
                            <div>
                                <h3 className="font-semibold text-lg text-indigo-300 truncate" title={vouch.metadata?.name || `Vouch #${vouch.sbtId}`}>
                                    {vouch.metadata?.name || `Vouch #${vouch.sbtId}`}
                                </h3>
                                <p className="text-xs text-slate-500 mb-3">SBT ID: {vouch.sbtId}</p>

                                <div className="space-y-2 text-sm text-slate-300">
                                    <p><strong>Backer:</strong> <span className="font-mono text-slate-400" title={vouch.backer}>{shortBacker}</span></p>
                                    <p><strong>Borrower:</strong> <span className="font-mono text-slate-400" title={vouch.borrower}>{shortBorrower}</span></p>
                                    <p><strong>Staked:</strong> <span className="text-white">{displayAmount} ETH</span></p>
                                    <p><strong>Expires:</strong> <span className="text-white">{displayExpiry}</span></p>
                                </div>
                                
                                {vouch.metadata?.description && <p className="text-sm mt-3 text-slate-200 break-words line-clamp-3">{vouch.metadata.description}</p>}
                                {vouch.metadataCID && <a href={`https://gateway.pinata.cloud/ipfs/${vouch.metadataCID}`} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center">View Metadata on IPFS <ExternalLink size={12} className="ml-1.5"/></a>}
                            </div>
                            <div className="mt-auto pt-3 border-t border-slate-700/50">
                                {!isMyVouch && (
                                    <Button onClick={() => handleOpenChallengeModal(vouch.sbtId, vouch.borrower, vouch.backer)} className="w-full btn-danger bg-orange-600 hover:bg-orange-700 text-xs !py-2">
                                        <ShieldQuestion size={14} className="mr-1.5"/> Challenge this Vouch
                                    </Button>
                                )}
                                {isMyVouch && <p className="text-xs text-center text-slate-500 italic">This vouch involves you.</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        <Modal isOpen={challengeModalOpen} onClose={() => setChallengeModalOpen(false)} title={`Challenge Vouch SBT #${vouchToChallenge?.id}`}>
            {vouchToChallenge && (
                <form onSubmit={handleChallengeSubmit} className="space-y-4">
                    <div>
                        <p className="text-sm text-slate-300">You are challenging Vouch ID: <strong className="font-semibold text-white">{vouchToChallenge.id}</strong></p>
                        <p className="mt-3 text-sm font-semibold text-white">Challenge Stake: <span className="text-orange-400">{displayStakeString}</span></p>
                    </div>
                    <div>
                        <label htmlFor="challengeReason" className="block text-sm font-medium text-slate-200 mb-1">Reason for Challenge <span className="text-red-500">*</span></label>
                        <Textarea id="challengeReason" value={challengeReason} onChange={(e) => setChallengeReason(e.target.value)} rows={4}
                            placeholder="Clearly explain why this vouch is being challenged..." required
                            className="bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                    <Button type="submit" className="w-full btn-danger bg-orange-600 hover:bg-orange-700 !py-2.5" disabled={isChallengePending || isChallengeConfirming}>
                        {isChallengePending || isChallengeConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldQuestion size={16} className="mr-2"/>}
                        {isChallengePending ? 'Submitting...' : isChallengeConfirming ? 'Confirming...' : `Submit Challenge & Stake`}
                    </Button>
                    {challengeFormMessage && <p className="text-green-400 text-sm text-center flex items-center justify-center gap-2 mt-2"><CheckCircle size={16}/> {challengeFormMessage}</p>}
                    {challengeFormError && <p className="text-red-400 text-sm text-center flex items-center justify-center gap-2 mt-2"><AlertTriangle size={16}/> {challengeFormError}</p>}
                </form>
            )}
        </Modal>
      </main>
    </div>
    );
}