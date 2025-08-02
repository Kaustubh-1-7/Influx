// app/request-reputation/page.jsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useSession, signIn } from 'next-auth/react';
import {
    REPUFI_SBT_CONTRACT_ADDRESS,
    REPUFI_SBT_ABI,
    REPUTATION_REQUEST_FEE_ETH_STRING,
    displayReputationRequestFee,
    MIN_GITHUB_SCORE_CONTRACT
} from '../../../lib/constants';
import { uploadJsonToIPFS } from '../../../lib/ipfsHelper';
import { useGitHubScore } from '../context/GitHubScoreContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Loader2, AlertTriangle, LockKeyhole, Info, Github, FileSignature, UploadCloud, CheckCircle, UserCheck2 } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Import the VantaDotsBackground component
import VantaDotsBackground from '../components/VantaDotsBackground';

export default function RequestReputationPage() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: session, status: sessionStatus } = useSession();
  const { scoreData, isFetchingScore, fetchScoreError, refreshScore } = useGitHubScore();

  const {
    data: hash,
    error: writeError,
    isPending: isWritePending,
    writeContract,
    reset: resetWriteContract
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError
  } = useWaitForTransactionReceipt({ hash });

  // Form State
  const [requestType, setRequestType] = useState('DAO Contributor Role');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState('15');

  const [formMessage, setFormMessage] = useState(null);
  const [formError, setFormError] = useState(null);

  const feeInWei = parseEther(REPUTATION_REQUEST_FEE_ETH_STRING);
  const displayFeeString = displayReputationRequestFee();

  const actualMinScoreThreshold = MIN_GITHUB_SCORE_CONTRACT / 10.0;
  const userScore = scoreData?.totalScore;
  const canRequest = typeof userScore === 'number' && userScore < actualMinScoreThreshold;
  const shouldBeBacker = typeof userScore === 'number' && userScore >= actualMinScoreThreshold;

  // --- Core logic functions (unchanged) ---
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.githubUsername && !scoreData && !isFetchingScore) {
      refreshScore(session.user.githubUsername);
    }
  }, [sessionStatus, session, scoreData, isFetchingScore, refreshScore]);

   const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null); setFormMessage(null);
    resetWriteContract();

    if (!isConnected || !connectedAddress) {
      setFormError('Please connect your wallet to submit a request.'); return;
    }
    // scoreData is manualAnalysisData || scoreDataFromContext
    if (!scoreData || scoreData.totalScore === undefined) {
      setFormError('A GitHub score (either from your login or manual input) must be analyzed first.'); return;
    }
    if (scoreData.totalScore >= (MIN_GITHUB_SCORE_CONTRACT / 10.0) ) { // Compare with 0-10 scale
      setFormError(`Score for ${scoreData.username} (${scoreData.totalScore.toFixed(1)}) is >= ${MIN_GITHUB_SCORE_CONTRACT / 10.0}. User can be a backer.`); return;
    }
    if (!requestType.trim()) { setFormError('Request type is required.'); return; }
    if (!description.trim()) { setFormError('Description is required.'); return; }
    const parsedDurationDays = parseInt(durationDays);
    if (isNaN(parsedDurationDays) || parsedDurationDays <= 0) {
      setFormError('Duration must be a positive number of days.'); return;
    }

    setFormMessage('Preparing reputation request...');
    try {
      const durationInSeconds = BigInt(parsedDurationDays * 24 * 60 * 60);
      const githubScoreForContract = BigInt(Math.floor(scoreData.totalScore * 10));

      setFormMessage('Uploading request metadata to IPFS...');
      const requestMetadata = {
        name: `Reputation Vouch Request: ${requestType} by ${scoreData.username || connectedAddress.substring(0,6)}`, // Use GitHub username if available
        description: `User ${connectedAddress} (GitHub Profile: ${scoreData.username || 'Not Provided'}, Analyzed Score: ${scoreData.totalScore.toFixed(1)}) is requesting a vouch for "${requestType}". Reason: ${description}`,
        external_url: scoreData.username ? `https://github.com/${scoreData.username}` : `https://yourdapp.com/user/${connectedAddress}`, // Example external URL
        // You could add an image for the request itself if desired
        // image: "ipfs://<CID_of_request_placeholder_image>"
        attributes: [
          { trait_type: "Requester Wallet Address", value: connectedAddress },
          // --- ADDED/MODIFIED ---
          { trait_type: "Requester GitHub Username", value: scoreData.username || "Not Specified" },
          { trait_type: "Requester Analyzed GitHub Score", value: scoreData.totalScore.toFixed(1) },
          // --- END ADDED/MODIFIED ---
          { trait_type: "GitHub Score (Sent to Contract)", value: githubScoreForContract.toString() },
          { trait_type: "Request Type", value: requestType },
          { trait_type: "Requested Vouch Duration", value: `${parsedDurationDays} days` },
          { trait_type: "Request Description Summary", value: description.substring(0, 100) + (description.length > 100 ? "..." : "") },
        ],
      };
      const metadataCID = await uploadJsonToIPFS(requestMetadata);
      setFormMessage(`Metadata uploaded (CID: ${metadataCID.substring(0,10)}...). Submitting request...`);

      console.log("Calling createReputationRequest with args:", { /* ... */ });
      setFormMessage(`Metadata uploaded. Submitting transaction (Fee: ${displayFeeString})...`);

      writeContract({
        address: REPUFI_SBT_CONTRACT_ADDRESS,
        abi: REPUFI_SBT_ABI,
        functionName: 'createReputationRequest',
        args: [ requestType, description, durationInSeconds, metadataCID, githubScoreForContract ],
        value: feeInWei,
      });

    } catch (err) {
      console.error('Request creation error:', err);
      setFormError(`Error: ${err.message || 'An error occurred during preparation.'}`);
      setFormMessage(null);
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      setFormMessage('Reputation request submitted successfully! Transaction confirmed.');
      setFormError(null);
      setRequestType('DAO Contributor Role'); setDescription(''); setDurationDays('15');
    }
     if (writeError) { setFormError(`Transaction Error: ${writeError.shortMessage || writeError.message}`); setFormMessage(null); }
     if (receiptError) { setFormError(`Confirmation Error: ${receiptError.shortMessage || receiptError.message}`); setFormMessage(null); }
  }, [isConfirmed, writeError, receiptError]);

  // ---- Render Logic with Updated UI ----
  const renderContent = () => {
    const cardBaseStyle = "bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-xl p-8 text-center max-w-md mx-auto animate-fadeIn";

    if (!isConnected) {
      return (
        <div className={`${cardBaseStyle} my-10`}>
          <LockKeyhole className="h-16 w-16 mx-auto text-indigo-400 opacity-70 mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-3">Connect Wallet</h2>
          <p className="text-slate-300 mb-6">
            Please connect your wallet to request reputation.
          </p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      );
    }

    if (sessionStatus === 'loading') {
      return <div className={cardBaseStyle}><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-400" /><p className="mt-2 text-slate-200">Loading user session...</p></div>;
    }

    if (sessionStatus === 'unauthenticated') {
      return (
        <div className={cardBaseStyle}>
          <Github className="h-16 w-16 mx-auto text-indigo-400 opacity-70 mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-3">GitHub Login Required</h2>
          <p className="text-slate-300 mb-6">
            To request a reputation vouch, please log in with your GitHub account first.
          </p>
          <Button onClick={() => signIn('github')} className="btn-secondary">
            <Github className="mr-2 h-5 w-5"/> Login with GitHub
          </Button>
        </div>
      );
    }

    if (isFetchingScore) {
      return <div className={cardBaseStyle}><Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-400" /><p className="mt-2 text-slate-200">Analyzing your GitHub profile ({session?.user?.githubUsername})...</p></div>;
    }

    if (fetchScoreError) {
      return (
        <div className="bg-slate-900/60 backdrop-blur-md border-l-4 border-red-500 rounded-r-lg p-6 text-center max-w-md mx-auto">
          <AlertTriangle className="h-10 w-10 mx-auto text-red-400 mb-3" />
          <h3 className="text-xl font-semibold text-red-300">Error Analyzing Score</h3>
          <p className="text-slate-300 mt-1">{fetchScoreError}</p>
          <Button onClick={() => refreshScore(session?.user?.githubUsername)} className="btn-outline mt-4 text-sm">
             Retry Analysis
          </Button>
        </div>
      );
    }

    if (!scoreData || typeof scoreData.totalScore !== 'number') {
      return (
          <div className={cardBaseStyle}>
              <Info className="h-10 w-10 mx-auto text-indigo-400 mb-3" />
              <h3 className="text-xl font-semibold text-white">GitHub Score Not Available</h3>
              <p className="text-slate-300 mt-1">We could not retrieve your GitHub score. Please try analyzing your profile.</p>
              <Button onClick={() => refreshScore(session?.user?.githubUsername)} className="btn-primary mt-4 text-sm">
                  Analyze My GitHub Profile
              </Button>
          </div>
      );
    }

    if (shouldBeBacker) {
      return (
        <div className="bg-slate-900/60 backdrop-blur-md border-l-4 border-green-500 rounded-r-lg p-8 text-center max-w-md mx-auto">
          <UserCheck2 className="h-16 w-16 mx-auto text-green-400 mb-4" />
          <h2 className="text-2xl font-semibold text-green-300 mb-2">You're Eligible to be a Backer!</h2>
          <p className="text-slate-300 mb-1">
            Your GitHub score for <strong className='text-white'>{scoreData.username}</strong> is <strong className='text-white'>{scoreData.totalScore.toFixed(1)}</strong>.
          </p>
          <p className="text-slate-300 mb-6">
            This meets the requirement of {actualMinScoreThreshold.toFixed(1)}. You can vouch for others.
          </p>
          <Link href="/become-backer" className="btn btn-primary">
            Go to Become a Backer Page
          </Link>
        </div>
      );
    }

    if (canRequest) {
      const inputStyle = "bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500";
      return (
        <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 animate-fadeIn shadow-2xl">
          <div className="text-center">
            <FileSignature className="h-10 w-10 mx-auto text-indigo-400 mb-2" />
            <h2 className="text-2xl font-semibold text-white">Submit Your Reputation Request</h2>
            <p className="text-sm text-slate-300 mt-1">
                Using GitHub profile: <strong className="text-indigo-300">{scoreData.username}</strong> (Score: {scoreData.totalScore.toFixed(1)})
            </p>
            <p className="text-sm text-yellow-300 bg-yellow-500/10 p-2 rounded-md mt-2">
                Your score is below {actualMinScoreThreshold.toFixed(1)}. Proceed with your request.
            </p>
          </div>
          <div>
            <label htmlFor="requestType" className="block text-sm font-medium text-slate-200 mb-1.5">Request Type <span className="text-red-500">*</span></label>
            <Input type="text" id="requestType" value={requestType} onChange={(e) => setRequestType(e.target.value)} placeholder="e.g., Access to Grant Platform" required className={inputStyle}/>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-200 mb-1.5">Brief Description of Need <span className="text-red-500">*</span></label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Explain why you need this vouch and what you aim to achieve..." required className={inputStyle}/>
          </div>
          <div>
            <label htmlFor="durationDaysReq" className="block text-sm font-medium text-slate-200 mb-1.5">Requested Vouch Duration (days) <span className="text-red-500">*</span></label>
            <Input type="number" id="durationDaysReq" value={durationDays} min="1" onChange={(e) => setDurationDays(e.target.value)} required className={inputStyle}/>
            <p className="text-xs text-slate-400 mt-1">Contract max duration is 15 days (will be capped if higher).</p>
          </div>
          <Button type="submit" className="w-full btn-primary !py-3 !text-base" disabled={isWritePending || isConfirming}>
            {isWritePending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud size={20} className="mr-2"/>}
            {isWritePending ? 'Submitting Request...' : isConfirming ? 'Confirming Transaction...' : `Submit Request & Pay ${displayFeeString}`}
          </Button>
          {(formMessage && !formError) && <p className="mt-4 text-green-400 text-center flex items-center justify-center gap-2"><CheckCircle size={18}/>{formMessage}</p>}
          {formError && <p className="mt-4 text-red-400 text-center flex items-center justify-center gap-2"><AlertTriangle size={18}/>{formError}</p>}
        </form>
      );
    }

    return <div className={cardBaseStyle}><p className="text-slate-300">Please ensure your GitHub profile is analyzed.</p></div>;
  };

  return (
    <div className="relative min-h-screen text-white">
      <VantaDotsBackground />

      <main className="relative z-10 p-6 sm:p-8 md:p-12">
        <div className="space-y-10 max-w-2xl mx-auto pb-12">
            <header className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Request a Vouch</h1>
                <p className="text-lg text-slate-300">
                  If your GitHub score is below {actualMinScoreThreshold.toFixed(1)}, you can submit a request here.
                </p>
            </header>
            {renderContent()}
        </div>
      </main>
    </div>
  );
}