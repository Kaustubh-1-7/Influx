// app/(components)/CreateVouchForm.jsx
'use client';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, isAddress } from 'viem';
import { REPUFI_SBT_CONTRACT_ADDRESS, REPUFI_SBT_ABI } from '../../../lib/constants';
import { uploadJsonToIPFS } from '../../../lib/ipfsHelper';
import { Button } from './ui/Button'; // Assuming these are styled well
import { Input } from './ui/Input';   // Assuming these are styled well
import { Textarea } from './ui/Textarea';// Assuming these are styled well
import { Loader2, CheckCircle2, AlertTriangle, Info, UserPlus, Coins, CalendarClock, FileText, UserCheck, ShieldQuestion } from 'lucide-react';

const getDefaultSbtSvgImageClientSide = () => {
  const svgXml = `
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" rx="30" fill="url(#grad)"/>
      <circle cx="100" cy="100" r="70" fill="rgba(255,255,255,0.1)"/>
      <path d="M60 100 L90 130 L140 80" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="50%" y="175" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="white" font-weight="600">REPUFI VOUCH</text>
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(210, 90%, 50%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(260, 70%, 60%);stop-opacity:1" />
        </linearGradient>
      </defs>
    </svg>
  `;
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svgXml)))}`;
  }
  return "";
};

export default function CreateVouchForm({ githubProfileData }) {
  const { address: connectedAddress } = useAccount();
  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({ hash });

  const [borrower, setBorrower] = useState('');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [reason, setReason] = useState('');
  const [backerRepStats, setBackerRepStats] = useState('');
  const [formMessage, setFormMessage] = useState(null);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (githubProfileData && githubProfileData.username) {
      const stats = {
        githubUsername: githubProfileData.username,
        githubScore: githubProfileData.totalScore.toFixed(1),
        githubUrl: githubProfileData.details.githubUrl, // Add GitHub URL for metadata
        publicRepos: githubProfileData.details.publicRepos,
        followers: githubProfileData.details.followers,
        totalStars: githubProfileData.details.totalStars,
      };
      setBackerRepStats(JSON.stringify(stats, null, 2));
    } else {
      setBackerRepStats(JSON.stringify({ githubUsername: "NOT_ANALYZED", githubScore: "0.0" }, null, 2));
    }
  }, [githubProfileData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null); setFormMessage(null);

    if (!connectedAddress) { setFormError('Please connect your wallet.'); return; }
    if (!isAddress(borrower)) { setFormError('Invalid borrower address. Please enter a valid Ethereum address.'); return; }
    if (borrower.toLowerCase() === connectedAddress.toLowerCase()) { setFormError('You cannot vouch for yourself.'); return; }
    if (parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) { setFormError('Stake amount must be a positive number.'); return; }
    const parsedDurationDays = parseInt(durationDays);
    if (parsedDurationDays <= 0 || isNaN(parsedDurationDays)) { setFormError('Duration must be a positive number of days.'); return; }
    // Assuming contract's maxDuration is 15 days based on contract code (15 days in seconds)
    // You might want to fetch maxDuration from the contract for accuracy
    const contractMaxDurationDays = 15; 
    if (parsedDurationDays > contractMaxDurationDays) {
        setFormError(`Duration cannot exceed ${contractMaxDurationDays} days.`); return;
    }

    if (!reason.trim()) { setFormError('Please provide a reason for the vouch.'); return; }

    setFormMessage('Processing vouch creation...');
    try {
      const stakeAmountWei = parseEther(amount);
      const durationSeconds = BigInt(parsedDurationDays * 24 * 60 * 60);

      setFormMessage('Validating reputation data...');
      let parsedBackerRepStats = {};
      try { parsedBackerRepStats = JSON.parse(backerRepStats); }
      catch (parseErr) { setFormError("Backer reputation stats are not valid JSON."); setFormMessage(null); return; }

      setFormMessage('Generating SBT image and metadata...');
      const sbtImage = getDefaultSbtSvgImageClientSide();
      if (!sbtImage) { setFormError("Could not generate SBT image."); setFormMessage(null); return; }

      const metadata = {
        name: `RepuFi Vouch: ${parsedBackerRepStats.githubUsername || 'Backer'} for ${borrower.substring(0,6)}...${borrower.substring(borrower.length - 4)}`,
        description: `A RepuFi Soul-Bound Token representing a vouch by Backer ${connectedAddress} (GitHub: ${parsedBackerRepStats.githubUsername || 'N/A'}) for Borrower ${borrower}. Score: ${parsedBackerRepStats.githubScore || 'N/A'}. Reason: ${reason}.`,
        image: sbtImage,
        external_url: parsedBackerRepStats.githubUrl || `https://repu-fi-app.com/profile/${connectedAddress}`, // Link to backer's profile
        attributes: [
          { trait_type: "Vouch Type", value: "Developer Endorsement" },
          { trait_type: "Vouch Reason", value: reason },
          { trait_type: "Stake Amount (PAS)", value: amount },
          { trait_type: "Duration (Days)", value: durationDays },
          { trait_type: "Backer Address", value: connectedAddress },
          { trait_type: "Borrower Address", value: borrower },
          ...Object.entries(parsedBackerRepStats).map(([key, value]) => ({
            trait_type: `Backer ${key.replace(/([A-Z])/g, ' $1').trim()}`,
            value: String(value)
          }))
        ],
      };
      setFormMessage('Uploading metadata to IPFS...');
      const metadataCID = await uploadJsonToIPFS(metadata);
      setFormMessage(`Metadata uploaded (CID: ${metadataCID.substring(0,10)}...). Submitting transaction...`);
      writeContract({
        address: REPUFI_SBT_CONTRACT_ADDRESS, abi: REPUFI_SBT_ABI,
        functionName: 'createVouch', args: [borrower, durationSeconds, metadataCID], value: stakeAmountWei,
      });
    } catch (err) {
      console.error('Vouch creation error:', err);
      setFormError(`Error: ${err.shortMessage || err.message || 'An unknown error occurred.'}`);
      setFormMessage(null);
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      setFormMessage('Vouch created successfully! Transaction confirmed.'); setFormError(null);
      setBorrower(''); setAmount(''); setDurationDays('30'); setReason('');
    }
    if (writeError) { setFormError(`Transaction Error: ${writeError.shortMessage || writeError.message}`); setFormMessage(null); }
    if (receiptError) { setFormError(`Confirmation Error: ${receiptError.shortMessage || receiptError.message}`); setFormMessage(null); }
  }, [isConfirmed, writeError, receiptError]);

  if (!connectedAddress) return (
    <div className="card p-6 text-center mt-6">
      <Info size={32} className="mx-auto text-primary mb-3"/>
      <p className="font-semibold">Please connect your wallet to create a vouch.</p>
    </div>
  );
  if (!githubProfileData || githubProfileData.totalScore < 7) {
    return (
      <div className="card p-6 text-center mt-6 border-l-4 border-yellow-500 dark:border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
        <AlertTriangle size={32} className="mx-auto text-yellow-600 dark:text-yellow-400 mb-3"/>
        <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Vouching Prerequisite Not Met</h3>
        <p className="text-slate-700 dark:text-slate-300">
          Your analyzed GitHub score must be 7 or higher to become a backer.
          Current score for ({githubProfileData?.username || "profile not analyzed"}): {githubProfileData?.totalScore?.toFixed(1) || "N/A"}.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Please analyze a GitHub profile with a sufficient score on the "Become a Backer" page first.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 md:p-8 animate-fadeIn mt-8 shadow-2xl dark:shadow-primary/20">
      <div className="text-center mb-8 pb-4 border-b border-border dark:border-dark-border">
        <UserCheck size={36} className="mx-auto text-green-500 dark:text-green-400 mb-3" />
        <h2 className="text-3xl font-bold text-foreground">Create Your Vouch</h2>
        <p className="text-md text-slate-600 dark:text-slate-300 mt-1">
            Backing as <span className="font-semibold text-primary">{githubProfileData.username}</span> (Score: <span className="font-bold">{githubProfileData.totalScore.toFixed(1)}</span>)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Borrower Address Field */}
        <div className="p-4 border border-border dark:border-dark-border rounded-lg shadow-sm bg-background dark:bg-dark-card/30">
          <label htmlFor="borrower" className="flex items-center text-sm font-semibold text-foreground mb-2">
            <UserPlus size={18} className="mr-2 text-primary"/>Who are you vouching for?
          </label>
          <Input
            type="text" id="borrower" value={borrower} onChange={(e) => setBorrower(e.target.value)}
            placeholder="Enter Borrower's Ethereum Address (0x...)" required
            className="border-slate-300 dark:border-slate-600 focus:border-primary dark:focus:border-primary focus:ring-primary dark:focus:ring-primary"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">The address of the user you trust and want to back.</p>
        </div>

        {/* Stake Amount & Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 border border-border dark:border-dark-border rounded-lg shadow-sm bg-background dark:bg-dark-card/30">
            <label htmlFor="amount" className="flex items-center text-sm font-semibold text-foreground mb-2">
                <Coins size={18} className="mr-2 text-primary"/>How much PAS to stake?
            </label>
            <Input
              type="number" id="amount" step="any" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 100" required
              className="border-slate-300 dark:border-slate-600 focus:border-primary dark:focus:border-primary focus:ring-primary dark:focus:ring-primary"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">This is your collateral, returned if the vouch is successful.</p>
          </div>
          <div className="p-4 border border-border dark:border-dark-border rounded-lg shadow-sm bg-background dark:bg-dark-card/30">
            <label htmlFor="durationDays" className="flex items-center text-sm font-semibold text-foreground mb-2">
                <CalendarClock size={18} className="mr-2 text-primary"/>For how long (days)?
            </label>
            <Input
              type="number" id="durationDays" value={durationDays} min="1" max="15" onChange={(e) => setDurationDays(e.target.value)}
              required
              className="border-slate-300 dark:border-slate-600 focus:border-primary dark:focus:border-primary focus:ring-primary dark:focus:ring-primary"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Contract maximum is 15 days.</p>
          </div>
        </div>

        {/* Reason for Vouch */}
        <div className="p-4 border border-border dark:border-dark-border rounded-lg shadow-sm bg-background dark:bg-dark-card/30">
          <label htmlFor="reason" className="flex items-center text-sm font-semibold text-foreground mb-2">
            <FileText size={18} className="mr-2 text-primary"/>Why are you vouching?
          </label>
          <Textarea
            id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder="Describe your trust in this borrower and the purpose of the vouch (e.g., 'Reliable contributor for Project X grant application'). Be specific." required
            className="border-slate-300 dark:border-slate-600 focus:border-primary dark:focus:border-primary focus:ring-primary dark:focus:ring-primary"
          />
        </div>

        {/* Backer Reputation Stats (Read-only) */}
        <div className="p-4 border border-border dark:border-dark-border rounded-lg shadow-sm bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between mb-2">
                <label htmlFor="backerRepStats" className="flex items-center text-sm font-semibold text-foreground">
                    <ShieldQuestion size={18} className="mr-2 text-primary"/>Your Backer Reputation Data (JSON)
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">(Auto-filled, read-only)</span>
            </div>
          <Textarea id="backerRepStats" value={backerRepStats} rows={7} readOnly
            className="bg-slate-100 dark:bg-slate-700/50 text-xs font-mono !border-slate-200 dark:!border-slate-700 cursor-not-allowed"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">This data from your GitHub analysis will be publicly recorded on IPFS within the Vouch SBT.</p>
        </div>

        <Button type="submit" className="w-full btn-primary !py-3.5 !text-lg !font-semibold mt-8" disabled={isWritePending || isConfirming}>
          {isWritePending || isConfirming ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle2 className="mr-2 h-6 w-6"/>}
          {isWritePending ? 'Submitting Vouch...' : isConfirming ? 'Confirming Transaction...' : `Create Vouch & Stake ${amount || '0'} PAS`}
        </Button>
      </form>

      {(formMessage && !formError) && <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg text-sm text-center animate-fadeIn flex items-center gap-2"><Info size={18}/> {formMessage}</div>}
      {formError && <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm text-center animate-fadeIn flex items-center gap-2"><AlertTriangle size={18}/> {formError}</div>}
    </div>
  );
}