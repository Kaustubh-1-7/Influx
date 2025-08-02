// app/challenge-vouch/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import {
    REPUFI_SBT_CONTRACT_ADDRESS,
    REPUFI_SBT_ABI,
    CHALLENGE_STAKE_ETH_STRING, // e.g., "0.015"
    displayChallengeStake         // e.g., "0.015 PAS"
} from '../../../lib/constants'; // Adjust path
import { Button } from '../components/ui/Button';   // Adjust path
import { Input } from '../components/ui/Input';     // Adjust path
import { Textarea } from '../components/ui/Textarea'; // Adjust path
import { Loader2, ShieldQuestion, LockKeyhole, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ChallengeVouchPage() {
  const { address: connectedAddress, isConnected } = useAccount();
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

  const [vouchTokenId, setVouchTokenId] = useState('');
  const [challengeReason, setChallengeReason] = useState('');
  const [formMessage, setFormMessage] = useState(null);
  const [formError, setFormError] = useState(null);

  const challengeStakeInWei = parseEther(CHALLENGE_STAKE_ETH_STRING);
  const displayStakeString = displayChallengeStake();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null); setFormMessage(null);
    resetWriteContract();

    if (!isConnected || !connectedAddress) {
      setFormError('Please connect your wallet to submit a challenge.'); return;
    }
    const parsedTokenId = parseInt(vouchTokenId);
    if (isNaN(parsedTokenId) || parsedTokenId <= 0) {
      setFormError('Please enter a valid Vouch SBT Token ID.'); return;
    }
    if (!challengeReason.trim()) {
      setFormError('A reason for the challenge is required.'); return;
    }

    setFormMessage(`Preparing challenge for Vouch SBT #${parsedTokenId}...`);
    try {
      setFormMessage(`Submitting challenge transaction (Stake: ${displayStakeString})...`);

      console.log("Calling createChallenge with args:", {
          vouchTokenId: BigInt(parsedTokenId),
          challengeReason,
          value: challengeStakeInWei.toString()
      });

      writeContract({
        address: REPUFI_SBT_CONTRACT_ADDRESS,
        abi: REPUFI_SBT_ABI,
        functionName: 'createChallenge',
        args: [BigInt(parsedTokenId), challengeReason],
        value: challengeStakeInWei, // This is the CHALLENGE_STAKE defined in contract
      });

    } catch (err) {
      console.error('Challenge creation error:', err);
      setFormError(`Error: ${err.message || 'An error occurred during preparation.'}`);
      setFormMessage(null);
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      setFormMessage('Challenge submitted successfully! Transaction confirmed.');
      setFormError(null);
      setVouchTokenId(''); setChallengeReason(''); // Reset form
    }
     if (writeError) {
        setFormError(`Transaction Error: ${writeError.shortMessage || writeError.message}`);
        setFormMessage(null);
    }
    if (receiptError) {
        setFormError(`Confirmation Error: ${receiptError.shortMessage || receiptError.message}`);
        setFormMessage(null);
    }
  }, [isConfirmed, writeError, receiptError]);

  if (!isConnected) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto my-10 animate-fadeIn">
        <LockKeyhole className="h-16 w-16 mx-auto text-primary opacity-70 mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-3">Connect Wallet</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Please connect your wallet to challenge a vouch.
        </p>
        <div className="flex justify-center"><ConnectButton /></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-12">
      <header className="text-center pt-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2 flex items-center justify-center gap-3">
            <ShieldQuestion className="h-10 w-10 text-orange-500" /> Challenge a Vouch
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          If you believe a vouch is invalid or the borrower has acted maliciously, you can initiate a challenge.
          This requires staking <strong className="text-primary">{displayStakeString}</strong>.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6 animate-fadeIn shadow-xl">
        <div className="text-center">
            <ShieldAlert className="h-10 w-10 mx-auto text-orange-500 mb-2" />
            <h2 className="text-2xl font-semibold text-foreground">Submit a Challenge</h2>
        </div>
        <div>
          <label htmlFor="vouchTokenId" className="block text-sm font-medium text-foreground mb-1.5">
            Vouch SBT Token ID to Challenge <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            id="vouchTokenId"
            value={vouchTokenId}
            onChange={(e) => setVouchTokenId(e.target.value)}
            placeholder="Enter the Token ID of the Vouch SBT"
            required
            className="input"
          />
        </div>
        <div>
          <label htmlFor="challengeReason" className="block text-sm font-medium text-foreground mb-1.5">
            Reason for Challenge <span className="text-red-500">*</span>
          </label>
          <Textarea
            id="challengeReason"
            value={challengeReason}
            onChange={(e) => setChallengeReason(e.target.value)}
            rows={5}
            placeholder="Clearly explain why this vouch is being challenged. Provide evidence or context if possible."
            required
            className="input"
          />
        </div>

        <Button
            type="submit"
            className="w-full btn-danger bg-orange-500 hover:bg-orange-600 !py-3 !text-base"
            disabled={isWritePending || isConfirming}
        >
          {isWritePending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {isWritePending ? 'Submitting Challenge...' : isConfirming ? 'Confirming Transaction...' : `Submit Challenge & Stake ${displayStakeString}`}
        </Button>
        {(formMessage && !formError) && <p className="mt-4 text-green-600 dark:text-green-400 text-center animate-fadeIn flex items-center justify-center gap-2"><CheckCircle size={18}/>{formMessage}</p>}
        {formError && <p className="mt-4 text-red-600 dark:text-red-400 text-center animate-fadeIn flex items-center justify-center gap-2"><AlertTriangle size={18}/>{formError}</p>}
      </form>
    </div>
  );
}