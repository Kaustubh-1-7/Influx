// app/(components)/MyVouchesClient.jsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { REPUFI_SBT_CONTRACT_ADDRESS, REPUFI_SBT_ABI } from '../../../lib/constants';
import { fetchFromIPFS } from '../../../lib/ipfsHelper';
import { formatEther } from 'viem';
import { Loader2, ShieldAlert, UserCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { VouchCard } from './VouchCard';

// Animation variants for the page
const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};


// --- Main Component ---
export default function MyVouchesClient() {
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [ownedSBTsDetails, setOwnedSBTsDetails] = useState([]);
  const [isLoadingSBTs, setIsLoadingSBTs] = useState(true);
  const [errorSBTs, setErrorSBTs] = useState(null);
  const [actionTokenId, setActionTokenId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: ownedSBTsData, refetch: refetchOwnedSBTs, isLoading: isSBTListLoading } = useReadContract({
    address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'getOwnedSBTs',
    args: [userAddress], query: { enabled: !!userAddress && isConnected },
  });

  const {data: contractOwner} = useReadContract({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'owner', query: { enabled: isConnected && !!userAddress } });
  const isAdmin = isConnected && userAddress && contractOwner && userAddress.toLowerCase() === contractOwner.toLowerCase();

  useEffect(() => {
    // =========================================================================
    // === KEY CHANGE: Intelligent Metadata Parsing ===
    // This function now processes the raw metadata to find the best "reason"
    // before passing it to the VouchCard component.
    // =========================================================================
    const fetchVouchAndMetadata = async (tokenId) => {
        if (!publicClient) return null;
        try {
            const details = await publicClient.readContract({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName: 'getVouchDetails', args: [tokenId] });
            let metadata = {};
            if (details.metadataCID) {
                try { 
                    metadata = await fetchFromIPFS(details.metadataCID); 
                } catch (ipfsErr) { 
                    console.warn(`IPFS fetch error for CID ${details.metadataCID}: ${ipfsErr.message}`);
                    metadata = { name: `Vouch #${tokenId}`, description: "Could not load reason from IPFS.", image: null };
                }
            }

            // Helper function to find the best reason from structured attributes
            const getReasonFromMetadata = (md) => {
              if (md.attributes && Array.isArray(md.attributes)) {
                // Prioritize the shorter, cleaner "Vouch Type"
                const vouchTypeAttr = md.attributes.find(attr => attr.trait_type === "Vouch Type");
                if (vouchTypeAttr?.value) return vouchTypeAttr.value;

                // Fallback to the more detailed "Backer's Reason/Note"
                const reasonNoteAttr = md.attributes.find(attr => attr.trait_type === "Backer's Reason/Note");
                if (reasonNoteAttr?.value) return reasonNoteAttr.value;
              }
              // Final fallback to the long description if no structured attributes are found
              return md.description || 'No reason provided.';
            };

            return {
                id: tokenId.toString(),
                backer: details.backer,
                borrower: details.borrower,
                amount: formatEther(details.amount),
                expiryDate: new Date(Number(details.expiry) * 1000).toLocaleString(),
                withdrawn: details.withdrawn,
                forceExpired: details.forceExpired,
                metadataCID: details.metadataCID,
                
                // Use the new helper function to set clean, display-ready props
                name: metadata.name || `Vouch SBT #${tokenId.toString()}`,
                reason: getReasonFromMetadata(metadata),
                image: metadata.image || null,

                isMyVouchAsBacker: details.backer.toLowerCase() === userAddress.toLowerCase(),
                isMyVouchAsBorrower: details.borrower.toLowerCase() === userAddress.toLowerCase(),
                isExpired: new Date().getTime() / 1000 > Number(details.expiry) || details.forceExpired,
            };
        } catch (err) { console.error(`Error fetching details for token ${tokenId}:`, err); return null; }
    };
    
    const loadSBTDetails = async () => {
        if (!isConnected || !userAddress || ownedSBTsData === undefined) {
            setIsLoadingSBTs(false);
            return;
        }
        setIsLoadingSBTs(true);
        setErrorSBTs(null);
        if (ownedSBTsData.length === 0) {
            setOwnedSBTsDetails([]);
        } else {
            try {
                const promises = ownedSBTsData.map(id => fetchVouchAndMetadata(id));
                const results = (await Promise.all(promises)).filter(Boolean);
                results.sort((a, b) => parseInt(b.id) - parseInt(a.id));
                setOwnedSBTsDetails(results);
            } catch (err) {
                setErrorSBTs(`Failed to load vouch details: ${err.message}`);
            }
        }
        setIsLoadingSBTs(false);
    };

    loadSBTDetails();

  }, [ownedSBTsData, isConnected, userAddress, publicClient]);

  const { data: actionHash, writeContract: executeAction, isPending: isActionPending, error: actionWriteError } = useWriteContract();
  const { isLoading: isActionConfirming, isSuccess: isActionConfirmed, error: actionReceiptError } = useWaitForTransactionReceipt({ hash: actionHash });
  
  const handleAction = useCallback((functionName, tokenId) => {
    setActionTokenId(tokenId); setActionMessage(null); setActionError(null);
    executeAction({ address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI, functionName, args: [BigInt(tokenId)] });
  }, [executeAction]);

  useEffect(() => {
    if (isActionPending && actionTokenId) setActionMessage(`Processing action for Token ${actionTokenId}...`);
    if (isActionConfirmed && actionTokenId) {
      setActionMessage(`Action successful for Token ${actionTokenId}! Refreshing details...`);
      refetchOwnedSBTs();
      setTimeout(() => { setActionMessage(null); setActionTokenId(null); }, 4000);
    }
    if (actionWriteError && actionTokenId) setActionError(`Tx Error for Token ${actionTokenId}: ${actionWriteError.shortMessage || actionWriteError.message}`);
    if (actionReceiptError && actionTokenId) setActionError(`Confirm Error for Token ${actionTokenId}: ${actionReceiptError.shortMessage || actionReceiptError.message}`);
  }, [isActionPending, isActionConfirmed, actionWriteError, actionReceiptError, actionTokenId, refetchOwnedSBTs]);
  
  const cardGridVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

  if (!isConnected) return ( 
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-10 text-center border-2 border-dashed border-white/10 bg-black/20 backdrop-blur-lg rounded-2xl max-w-md mx-auto"> 
      <UserCircle size={60} className="mx-auto text-cyan-400 mb-4"/> 
      <h3 className="text-2xl font-bold text-white mb-2">Wallet Not Connected</h3> 
      <p className="text-gray-400">Please connect your wallet to view your personal vouches.</p> 
    </motion.div> 
  );

  if (isSBTListLoading || isLoadingSBTs) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
        <p className="font-semibold text-white text-lg">Loading your Vouch SBTs...</p>
        <p className="text-slate-400 text-sm">Fetching details from the chain.</p>
    </div>
  );

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants}>
        {!isLoadingSBTs && ownedSBTsDetails.length === 0 && !errorSBTs && (
          <div className="max-w-lg p-10 mx-auto text-center border-2 border-dashed rounded-2xl border-white/10 bg-black/20 backdrop-blur-lg">
            <ShieldAlert className="h-16 w-16 mx-auto text-slate-500 mb-5" />
            <h3 className="text-2xl font-semibold text-white mb-3">No Vouch SBTs Found</h3>
            <p className="text-gray-400 mb-6">You currently don't own any RepuFi Vouch SBTs on this account.</p>
            <Link href="/become-backer">
              <motion.span whileHover={{scale: 1.05}} whileTap={{scale: 0.98}} className="btn !bg-cyan-600 hover:!bg-cyan-500 !text-white !text-base !px-6 !py-3 inline-flex items-center">
                <Users size={18} className="mr-2" />Become a Backer
              </motion.span>
            </Link>
          </div>
        )}
        {ownedSBTsDetails.length > 0 && (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" variants={cardGridVariants} initial="hidden" animate="visible">
            {ownedSBTsDetails.map((vouch) => (
              <VouchCard key={vouch.id} vouch={vouch} isAdmin={isAdmin} handleAction={handleAction} isActionPending={isActionPending} isActionConfirming={isActionConfirming} actionTokenId={actionTokenId} />
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}