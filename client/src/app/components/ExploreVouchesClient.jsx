// app/(components)/ExploreVouchesClient.jsx

'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { REPUFI_SBT_CONTRACT_ADDRESS, REPUFI_SBT_ABI } from '../../../lib/constants';
import { fetchFromIPFS } from '../../../lib/ipfsHelper';
import { formatEther } from 'viem';
import { Button } from './ui/Button';
import { Loader2, ExternalLink, Search, ShieldCheck, ShieldAlert, Image as ImageIcon, ThumbsUp, UserCircle, Info , RefreshCw} from 'lucide-react';

// NEW: Import the background component
import BackgroundAurora from './BackgroundAurora';

// VouchCard Component - Revamped with the new "Glassmorphism" theme
const VouchCard = ({ vouch, isAdmin, handleAdminActionParent, pendingAdminAction }) => {
    // --- All your existing logic is preserved ---
    if (!vouch || !vouch.details) return null;
    const { details, metadata, id: vouchTokenIdStr } = vouch;
    const vouchTokenId = BigInt(vouchTokenIdStr);

    const isActive = !details.withdrawn && !details.forceExpired;
    const isPotentiallyExpired = new Date().getTime() / 1000 > details.expiry && isActive;

    let status = { text: "ACTIVE", className: "bg-green-500/10 text-green-400", glowClass: "bg-green-500" };
    if (details.forceExpired) status = { text: "FORCE EXPIRED", className: "bg-red-500/10 text-red-400", glowClass: "bg-red-500" };
    else if (details.withdrawn) status = { text: "PROCESSED", className: "bg-gray-400/10 text-gray-400", glowClass: "bg-gray-500" };
    else if (isPotentiallyExpired) status = { text: "EXPIRED", className: "bg-amber-500/10 text-amber-400", glowClass: "bg-amber-500" };

    const isCurrentCardActionPending = pendingAdminAction && pendingAdminAction.tokenId === vouchTokenIdStr && pendingAdminAction.isExecuting;

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    };

    // UPDATED: Completely revamped JSX for the glassmorphism look
    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="group relative h-full flex flex-col rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-lg overflow-hidden"
        >
            {/* NEW: Hover Glow Effect */}
            <div className="absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(350px_at_50%_50%,rgba(0,255,255,0.1),transparent)]" />
            
            <div className="relative z-10 flex h-full flex-col p-4 space-y-4">
                {/* UPDATED: Image Display with a stylized container */}
                <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_50%)]" />
                    {metadata?.image ? (
                        <img src={metadata.image} alt={`Vouch SBT ${vouchTokenIdStr}`} className="w-full h-40 object-cover rounded-md"
                            onError={(e) => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }}
                        />
                    ) : null}
                    <div className={`w-full h-40 bg-white/5 rounded-md flex-col items-center justify-center text-slate-500 ${metadata?.image ? 'hidden' : 'flex'}`}>
                        <ImageIcon size={32} className="mb-2 opacity-50"/>
                        <span className="text-xs font-semibold">No Image Provided</span>
                    </div>
                </div>

                {/* UPDATED: Card Info with refined typography */}
                <div className="flex-grow">
                    <div className="flex items-start justify-between">
                        <h3 className="text-lg font-bold text-white">Vouch #{vouchTokenIdStr}</h3>
                        <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.glowClass}`} />
                            {status.text}
                        </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-400 line-clamp-2 h-10" title={metadata?.name || 'Vouch details'}>
                        {metadata?.name || `A RepuFi vouch for an on-chain agreement.`}
                    </p>
                </div>
                
                <hr className="!my-3 border-white/10" />

                {/* UPDATED: Details Section */}
                <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center"><span className="text-gray-400">Backer:</span><span className="font-mono text-gray-300">{`${details.backer.slice(0, 6)}...${details.backer.slice(-4)}`}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-400">Borrower:</span><span className="font-mono text-gray-300">{`${details.borrower.slice(0, 6)}...${details.borrower.slice(-4)}`}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-400">Stake:</span><span className="font-bold text-cyan-400">{formatEther(details.amount)} PAS</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-400">Expires:</span><span className="text-gray-300">{new Date(Number(details.expiry) * 1000).toLocaleDateString()}</span></div>
                </div>

                {/* UPDATED: Footer link and Admin buttons */}
                <div className="mt-auto pt-3">
                    {details.metadataCID && <a href={`https://gateway.pinata.cloud/ipfs/${details.metadataCID}`} target="_blank" rel="noopener noreferrer" className="group/link flex items-center gap-2 text-sm text-cyan-400 transition-colors hover:text-cyan-300">View Full Metadata<ExternalLink size={14} className="transition-transform duration-200 group-hover/link:translate-x-0.5" /></a>}
                    
                    {isAdmin && isActive && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                            <Button onClick={() => handleAdminActionParent('slashStake', vouchTokenId)} className="w-full !bg-amber-600/80 hover:!bg-amber-600 !text-white text-xs !font-bold" disabled={isCurrentCardActionPending}>
                                {isCurrentCardActionPending ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Admin: Slash Stake'}
                            </Button>
                            <Button onClick={() => handleAdminActionParent('forceExpire', vouchTokenId)} className="w-full !bg-red-600/80 hover:!bg-red-600 !text-white text-xs !font-bold" disabled={isCurrentCardActionPending}>
                                {isCurrentCardActionPending ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Admin: Force Expire'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};


export default function ExploreVouchesClient() {
    // --- All your state, hooks, and logic functions remain UNCHANGED ---
    const { address: connectedAddress, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [allVouches, setAllVouches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [pendingAdminActionState, setPendingAdminActionState] = useState({ tokenId: null, isExecuting: false });
    const [actionMessage, setActionMessage] = useState(null);
    const [actionError, setActionError] = useState(null);

    const { data: tokenIdCounterData, isLoading: isCounterLoading, refetch: refetchCounter } = useReadContract({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'tokenIdCounter', query: { staleTime: 60000 } });
    const { data: contractOwner } = useReadContract({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'owner', query: { enabled: isConnected } });
    const isAdmin = isConnected && connectedAddress && contractOwner && connectedAddress.toLowerCase() === contractOwner.toLowerCase();
    
    // ... fetchAllVouchDetails remains unchanged ...
    const fetchAllVouchDetails = useCallback(async () => {
        if (!publicClient || tokenIdCounterData === undefined || tokenIdCounterData === null) { if (tokenIdCounterData === undefined && !isCounterLoading) setError("Could not fetch total token count."); return; }
        setIsLoading(true); setError(null); const totalTokens = Number(tokenIdCounterData);
        if (totalTokens === 0) { setAllVouches([]); setIsLoading(false); return; }
        const promises = [];
        for (let i = 1; i <= totalTokens; i++) { const tokenId = BigInt(i); promises.push( publicClient.readContract({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'getVouchDetails', args: [tokenId], }).then(async (details) => { if (details && details.backer !== '0x0000000000000000000000000000000000000000') { let metadata = { name: `Vouch SBT #${tokenId.toString()}`, description: "Loading metadata..."}; if (details.metadataCID) { try { metadata = await fetchFromIPFS(details.metadataCID); } catch (e) { console.warn(`IPFS error for ${tokenId}: ${e.message}`); metadata.description = "Error loading metadata."; } } return { id: tokenId.toString(), details, metadata }; } return null; }).catch(err => { return null; })); }
        try { const results = (await Promise.all(promises)).filter(Boolean); const uniqueVouches = []; const seenPairedIds = new Set(); results.forEach(vouch => { if (vouch && vouch.details) { const currentTokenId = BigInt(vouch.id); const pairedTokenId = BigInt(vouch.details.pairedTokenId); const lowerId = currentTokenId < pairedTokenId ? currentTokenId : pairedTokenId; if (!seenPairedIds.has(lowerId)) { uniqueVouches.push(vouch); seenPairedIds.add(lowerId); } } }); setAllVouches(uniqueVouches.sort((a, b) => Number(b.id) - Number(a.id))); } catch (e) { setError("Error processing vouch details."); console.error("Error in Promise.all:", e); } finally { setIsLoading(false); }
    }, [publicClient, tokenIdCounterData, isCounterLoading]);

    // ... useEffects and handlers remain unchanged ...
    useEffect(() => { if (publicClient && tokenIdCounterData !== undefined) { fetchAllVouchDetails(); } }, [publicClient, tokenIdCounterData, fetchAllVouchDetails]);
    const { data: actionTxHash, writeContract: executeAdminTx, isPending: isTxPending, error: txWriteError } = useWriteContract();
    const { isLoading: isTxConfirming, isSuccess: isTxConfirmed, error: txReceiptError } = useWaitForTransactionReceipt({ hash: actionTxHash });
    const handleAdminAction = (functionName, tokenIdToActOn) => { setActionMessage(null); setActionError(null); setPendingAdminActionState({ tokenId: tokenIdToActOn.toString(), isExecuting: true }); executeAdminTx({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName, args: [tokenIdToActOn], }); };
    useEffect(() => { if (pendingAdminActionState.tokenId) { if (isTxPending) { setActionMessage(`Processing action for Vouch ID: ${pendingAdminActionState.tokenId}...`); } else if (isTxConfirmed) { setActionMessage(`Action successful for Vouch ID: ${pendingAdminActionState.tokenId}! Refreshing data...`); setPendingAdminActionState({ tokenId: null, isExecuting: false }); setTimeout(() => { refetchCounter().then(() => fetchAllVouchDetails()); }, 1000); setTimeout(() => setActionMessage(null), 5000); } else if (txWriteError) { setActionError(`Transaction Submission Error: ${txWriteError.shortMessage || txWriteError.message}`); setPendingAdminActionState({ tokenId: null, isExecuting: false }); } else if (txReceiptError) { setActionError(`Transaction Confirmation Error: ${txReceiptError.shortMessage || txReceiptError.message}`); setPendingAdminActionState({ tokenId: null, isExecuting: false }); } } }, [isTxPending, isTxConfirmed, txWriteError, txReceiptError, pendingAdminActionState, fetchAllVouchDetails, refetchCounter]);
    
    const filteredVouches = allVouches.filter(vouch => { const searchTermLower = searchTerm.toLowerCase(); if (!vouch || !vouch.details) return false; return ( vouch.id.includes(searchTermLower) || vouch.details.backer.toLowerCase().includes(searchTermLower) || vouch.details.borrower.toLowerCase().includes(searchTermLower) || (vouch.metadata?.name && vouch.metadata.name.toLowerCase().includes(searchTermLower)) ); });
    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } }, };

    // UPDATED: Main component return with new layout and background
    return (
        <div className="relative min-h-screen bg-[#0A031A] text-white overflow-hidden">
            <BackgroundAurora />

            <motion.main
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 p-6 sm:p-8 md:p-12 space-y-10"
            >
                {/* UPDATED: Header and Search section with refined styles */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Explore Vouchers</h1>
                        <p className="mt-2 text-md text-gray-400">
                            Discover all vouches on the RepuFi protocol.
                        </p>
                    </div>
                    <Button onClick={() => {refetchCounter().then(() => fetchAllVouchDetails())}} disabled={isLoading || isCounterLoading} className="w-full md:w-auto !py-2.5 !px-5 !bg-white/5 !border-white/10 hover:!bg-white/10">
                        {isLoading || isCounterLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <RefreshCw size={16} className="mr-2"/>}
                        Refresh Data
                    </Button>
                </div>
                <div className="relative">
                    <input
                        type="search" placeholder="Search by ID, Address, or Name..."
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 text-base bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                </div>

                <AnimatePresence>
                    {actionMessage && <motion.p initial={{opacity:0, y: -10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y:-10}} className="p-3 my-4 bg-green-500/20 text-green-300 rounded-lg text-sm text-center font-semibold">{actionMessage}</motion.p>}
                    {actionError && <motion.p initial={{opacity:0, y: -10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y:-10}} className="p-3 my-4 bg-red-500/20 text-red-300 rounded-lg text-sm text-center font-semibold">{actionError}</motion.p>}
                    {error && !isLoading && <motion.p initial={{opacity:0, y: -10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y:-10}} className="p-3 my-4 bg-red-500/20 text-red-300 rounded-lg text-sm text-center font-semibold">{error}</motion.p>}
                </AnimatePresence>
                
                {isLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
                        <p className="font-semibold text-white text-lg">Fetching all vouch details...</p>
                        <p className="text-slate-400 text-sm">This may take a moment.</p>
                    </div>
                )}

                {!isLoading && filteredVouches.length === 0 && (
                     <div className="min-h-[40vh] flex flex-col justify-center items-center text-center p-8 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl">
                        <motion.div initial={{scale:0.5, opacity:0}} animate={{scale:1, opacity:1}} transition={{delay:0.2, type:'spring'}}>
                            <ShieldAlert className="h-16 w-16 mx-auto text-slate-600 mb-5" />
                        </motion.div>
                        <h3 className="text-xl font-bold text-white mb-2">No Vouches Found</h3>
                        <p className="text-slate-400 max-w-sm mx-auto text-sm">
                            {searchTerm ? "Your search returned no results. Try a different query." : "There are currently no vouches on the protocol."}
                        </p>
                     </div>
                )}

                {!isLoading && filteredVouches.length > 0 && (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredVouches.map(vouch => (
                            <VouchCard
                                key={vouch.id}
                                vouch={vouch}
                                isAdmin={isAdmin}
                                handleAdminActionParent={handleAdminAction}
                                pendingAdminAction={pendingAdminActionState}
                            />
                        ))}
                    </motion.div>
                )}
            </motion.main>
        </div>
    );
}