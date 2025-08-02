// app/(components)/AdminActions.jsx
'use client';
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { REPUFI_SBT_CONTRACT_ADDRESS, REPUFI_SBT_ABI } from '../../../lib/constants';

export default function AdminActions() {
  const { address: connectedAddress } = useAccount();
  const [isOwner, setIsOwner] = useState(false);
  const [tokenIdInput, setTokenIdInput] = useState('');
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: contractOwner } = useReadContract({
    address: REPUFI_SBT_CONTRACT_ADDRESS,
    abi: REPUFI_SBT_ABI,
    functionName: 'owner',
  });

  useEffect(() => {
    if (connectedAddress && contractOwner) {
      setIsOwner(connectedAddress.toLowerCase() === contractOwner.toLowerCase());
    } else {
      setIsOwner(false);
    }
  }, [connectedAddress, contractOwner]);

  const { data: actionHash, writeContract: executeAdminAction, isPending: isAdminActionPending, error: adminActionWriteError } = useWriteContract();
  const { isLoading: isAdminActionConfirming, isSuccess: isAdminActionConfirmed, error: adminActionReceiptError } = useWaitForTransactionReceipt({ hash: actionHash });

  const handleAdminAction = (actionName) => {
    if (!tokenIdInput || isNaN(parseInt(tokenIdInput))) {
      setActionError("Please enter a valid Token ID.");
      return;
    }
    setActionMessage(null); setActionError(null);
    executeAdminAction({
      address: REPUFI_SBT_CONTRACT_ADDRESS,
      abi: REPUFI_SBT_ABI,
      functionName: actionName,
      args: [BigInt(tokenIdInput)],
    });
  };

  useEffect(() => {
    if(isAdminActionPending) setActionMessage(`Processing admin action for Token ID: ${tokenIdInput}...`);
    if (isAdminActionConfirmed) {
      setActionMessage(`Admin action successful for Token ID: ${tokenIdInput}! Consider refreshing vouches.`);
      setTokenIdInput('');
      setTimeout(() => setActionMessage(null), 4000);
    }
    if(adminActionWriteError) setActionError(`Transaction Error: ${adminActionWriteError.shortMessage || adminActionWriteError.message}`);
    if(adminActionReceiptError) setActionError(`Confirmation Error: ${adminActionReceiptError.shortMessage || adminActionReceiptError.message}`);
  }, [isAdminActionConfirmed, adminActionWriteError, adminActionReceiptError, isAdminActionPending, tokenIdInput]);


  if (!isOwner) {
    return null;
  }

  return (
    <div className="card mt-8">
      <h2 className="text-2xl font-semibold mb-6 text-center">Admin Panel</h2>
      <div className="space-y-4 max-w-md mx-auto">
        <div>
          <label htmlFor="adminTokenId">Token ID for Action:</label>
          <input
            type="number"
            id="adminTokenId"
            value={tokenIdInput}
            onChange={(e) => setTokenIdInput(e.target.value)}
            placeholder="Enter Vouch SBT Token ID"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleAdminAction('slashStake')}
            className="flex-1 btn btn-warning"
            disabled={!tokenIdInput || isAdminActionPending || isAdminActionConfirming}
          >
            {(isAdminActionPending || isAdminActionConfirming) ? 'Processing...' : 'Slash Stake'}
          </button>
          <button
            onClick={() => handleAdminAction('forceExpire')}
            className="flex-1 btn btn-danger"
            disabled={!tokenIdInput || isAdminActionPending || isAdminActionConfirming}
          >
            {(isAdminActionPending || isAdminActionConfirming) ? 'Processing...' : 'Force Expire & Burn SBTs'}
          </button>
        </div>
        {actionMessage && <p className="mt-3 text-green-600 dark:text-green-400 text-center">{actionMessage}</p>}
        {actionError && <p className="mt-3 text-red-600 dark:text-red-400 text-center">{actionError}</p>}
      </div>
    </div>
  );
}

