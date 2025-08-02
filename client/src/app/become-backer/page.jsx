// app/become-backer/page.jsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
import { useSession, signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  REPUFI_SBT_CONTRACT_ADDRESS,
  REPUFI_SBT_ABI,
  MIN_GITHUB_SCORE_CONTRACT,
} from "../../../lib/constants";
import { uploadJsonToIPFS, fetchFromIPFS } from "../../../lib/ipfsHelper";
import { useGitHubScore } from "../context/GitHubScoreContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import {
  Loader2,
  ShieldAlert,
  LockKeyhole,
  CheckCircle2,
  UserPlus,
  ExternalLink,
  Users,
  Github,
  Info,
  BarChartHorizontal,
  DollarSign,
  CalendarDays,
  UserCircle,
  RefreshCw,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import VantaDotsBackground from "../components/VantaDotsBackground";

// --- Reusable UI Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-slate-900 border border-slate-700 text-white p-6 rounded-xl shadow-2xl max-w-lg w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 mb-4">
              <h3 className="text-xl font-semibold">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 h-auto bg-transparent hover:bg-slate-700 rounded-full text-slate-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const getDefaultSbtSvgImageClientSide = () => {
  const svgXml = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" rx="20" fill="url(#g)"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="white" font-weight="bold">RepuFi</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white" font-weight="bold">VOUCH</text><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(210,90%,50%)"/><stop offset="100%" stop-color="hsl(260,70%,60%)"/></linearGradient></defs></svg>`;
  if (typeof window !== "undefined")
    return `data:image/svg+xml;base64,${window.btoa(
      unescape(encodeURIComponent(svgXml))
    )}`;
  return "";
};

const RequestCard = ({ req, handleOpenVouchModal }) => {
  const displayDurationDays = req.duration
    ? (Number(req.duration) / (24 * 60 * 60)).toFixed(0)
    : "N/A";
  const displayRequesterActualScore = req.githubScore
    ? (Number(req.githubScore) / 10).toFixed(1)
    : "N/A";
  const displayBorrowerStake =
    typeof req.borrowerStake === "bigint"
      ? formatEther(req.borrowerStake)
      : "N/A";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full rounded-[22px] p-[1px] bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 shadow-lg"
    >
      <div className="h-full rounded-[21px] bg-slate-900/90 backdrop-blur-sm text-white p-6 flex flex-col">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow">
            <h4 className="font-bold text-lg text-white mb-1 line-clamp-1">
              {req.metadata?.name || `Request #${req.id}`}
            </h4>
            <p
              className="text-sm text-slate-400 line-clamp-2"
              title={req.metadata?.description || req.description}
            >
              {req.metadata?.description ||
                req.description ||
                "No description."}
            </p>
          </div>
          {/* <Button
            onClick={() => handleOpenVouchModal(req)}
            className="btn-secondary !bg-cyan-600 hover:!bg-cyan-500 !text-white !px-4 !py-2 whitespace-nowrap"
          >
            <UserPlus size={16} className="mr-1.5" /> Vouch
          </Button> */}
        </div>
        <div className="my-4 border-t border-slate-700/50" />
        <div className="space-y-3 text-sm flex-grow">
          <div className="flex items-center gap-3">
            <UserCircle size={16} className="text-slate-400" />
            <span className="text-slate-300">Requester:</span>
            <span className="font-mono text-slate-100 ml-auto">
              {req.borrower.slice(0, 6)}...{req.borrower.slice(-4)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <BarChartHorizontal size={16} className="text-slate-400" />
            <span className="text-slate-300">Their Score:</span>
            <span className="font-semibold text-white ml-auto">
              {displayRequesterActualScore}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CalendarDays size={16} className="text-slate-400" />
            <span className="text-slate-300">Duration:</span>
            <span className="font-semibold text-white ml-auto">
              {displayDurationDays} days
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign size={16} className="text-slate-400" />
            <span className="text-slate-300">Fee Paid:</span>
            <span className="font-semibold text-cyan-400 ml-auto">
              {displayBorrowerStake} PAS
            </span>
          </div>
        </div>
        {req.metadataCID && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <a
              href={`https://gateway.pinata.cloud/ipfs/${req.metadataCID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link text-center w-full block text-sm text-cyan-400 transition-colors hover:text-cyan-300"
            >
              View Full Request
              <ExternalLink
                size={14}
                className="inline-block ml-1 transition-transform group-hover/link:translate-x-0.5"
              />
               </a>
              <Button
            onClick={() => handleOpenVouchModal(req)}
            className="btn-secondary ml-10 !bg-cyan-600 hover:!bg-cyan-500 !text-white !px-4 !py-2 whitespace-nowrap"
          >
            <UserPlus size={16} className="mr-1.5" /> Vouch
          </Button>
           
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function BecomeBackerPage() {
  // --- All original state and hooks are preserved ---
  const { address: connectedAddress, isConnected } = useAccount();
  const { data: session, status: sessionStatus } = useSession();
  const publicClient = usePublicClient();
  const { scoreData, isFetchingScore, fetchScoreError, refreshScore } =
    useGitHubScore();
  const [isEligibleBacker, setIsEligibleBacker] = useState(false);
  const [reputationRequests, setReputationRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [errorRequests, setErrorRequests] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [backerStakeAmount, setBackerStakeAmount] = useState("");
  const [vouchReason, setVouchReason] = useState(
    "Fulfilling user's reputation request."
  );
  const {
    data: vouchHash,
    writeContract: executeVouchForRequest,
    reset: resetVouchContract,
    isPending: isVouchPending,
    error: vouchWriteError,
  } = useWriteContract();
  const {
    isLoading: isVouchConfirming,
    isSuccess: isVouchConfirmed,
    error: vouchReceiptError,
  } = useWaitForTransactionReceipt({ hash: vouchHash });
  const [vouchFormMessage, setVouchFormMessage] = useState(null);
  const [vouchFormError, setVouchFormError] = useState(null);
  const actualMinScoreThreshold = MIN_GITHUB_SCORE_CONTRACT / 10.0;

  // --- All original logic and functions are preserved ---
  useEffect(() => {
    if (scoreData?.totalScore) {
      setIsEligibleBacker(scoreData.totalScore >= actualMinScoreThreshold);
    } else {
      setIsEligibleBacker(false);
    }
  }, [scoreData, actualMinScoreThreshold]);
  useEffect(() => {
    if (
      sessionStatus === "authenticated" &&
      session?.user?.githubUsername &&
      !scoreData &&
      !isFetchingScore
    ) {
      refreshScore(session.user.githubUsername);
    }
  }, [sessionStatus, session, scoreData, isFetchingScore, refreshScore]);
  const { data: requestCounterData, refetch: refetchRequestCounter } =
    useReadContract({
      address: REPUFI_SBT_CONTRACT_ADDRESS,
      abi: REPUFI_SBT_ABI,
      functionName: "reputationRequestCounter",
      query: { enabled: isConnected && isEligibleBacker },
    });
  const fetchAllOpenReputationRequests = useCallback(async () => {
    if (
      !publicClient ||
      requestCounterData === undefined ||
      !isEligibleBacker
    ) {
      setReputationRequests([]);
      return;
    }
    setIsLoadingRequests(true);
    setErrorRequests(null);
    setReputationRequests([]);
    const totalRequests = Number(requestCounterData);
    if (totalRequests === 0) {
      setIsLoadingRequests(false);
      return;
    }
    const fetchedRequestsArray = [];
    try {
      for (let i = totalRequests; i >= 1; i--) {
        try {
          const [
            borrower,
            requestType,
            description,
            duration,
            timestamp,
            metadataCID,
            fulfilled,
            githubScore,
            borrowerStake,
          ] = await publicClient.readContract({
            address: REPUFI_SBT_CONTRACT_ADDRESS,
            abi: REPUFI_SBT_ABI,
            functionName: "reputationRequests",
            args: [BigInt(i)],
          });
          if (
            borrower &&
            borrower !== "0x0000000000000000000000000000000000000000" &&
            !fulfilled
          ) {
            let ipfsMetadata = {};
            if (metadataCID)
              try {
                ipfsMetadata = await fetchFromIPFS(metadataCID);
              } catch (e) {
                console.warn(`IPFS error for ${i}: ${e.message}`);
              }
            fetchedRequestsArray.push({
              id: i,
              borrower,
              requestType,
              description,
              duration,
              timestamp,
              metadataCID,
              fulfilled,
              githubScore,
              borrowerStake,
              metadata: ipfsMetadata,
            });
          }
        } catch (e) {
          console.warn(`Error reading req ${i}: ${e.message}`);
        }
      }
      setReputationRequests(fetchedRequestsArray);
    } catch (err) {
      setErrorRequests(`Failed to load requests: ${err.message}`);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [publicClient, requestCounterData, isEligibleBacker]);
  useEffect(() => {
    if (isConnected && isEligibleBacker && requestCounterData !== undefined) {
      fetchAllOpenReputationRequests();
    }
  }, [
    isConnected,
    isEligibleBacker,
    requestCounterData,
    fetchAllOpenReputationRequests,
  ]);
  const handleOpenVouchModal = (request) => {
    setSelectedRequest(request);
    setBackerStakeAmount("");
    setVouchReason(
      `Fulfilling request for ${request.metadata?.name || request.requestType}`
    );
    setVouchFormError(null);
    setVouchFormMessage(null);
    resetVouchContract();
  };
  const handleVouchForRequestSubmit = async (e) => {
    e.preventDefault();
    setVouchFormError(null);
    setVouchFormMessage(null);
    resetVouchContract();
    if (
      !selectedRequest ||
      !isAddress(selectedRequest.borrower) ||
      !connectedAddress ||
      !scoreData
    ) {
      setVouchFormError("Required data missing.");
      return;
    }
    const parsedStakeAmount = parseFloat(backerStakeAmount);
    if (isNaN(parsedStakeAmount) || parsedStakeAmount <= 0) {
      setVouchFormError("Stake must be a positive number.");
      return;
    }
    if (
      selectedRequest.borrower.toLowerCase() === connectedAddress.toLowerCase()
    ) {
      setVouchFormError("You cannot vouch for yourself.");
      return;
    }
    if (!isEligibleBacker) {
      setVouchFormError("Your score is too low.");
      return;
    }
    setVouchFormMessage("Preparing vouch...");
    try {
      const stakeInWei = parseEther(backerStakeAmount);
      const vouchMetadata = {
        name: `RepuFi Vouch: ${
          scoreData.username
        } for ${selectedRequest.borrower.substring(0, 8)}`,
        description: `Vouch by ${connectedAddress} (GitHub: ${scoreData.username}) for ${selectedRequest.borrower}, fulfilling Request #${selectedRequest.id}. Reason: ${vouchReason}`,
        image: getDefaultSbtSvgImageClientSide(),
        attributes: [
          { trait_type: "Vouch Type", value: "Fulfilling Reputation Request" },
          {
            trait_type: "Original Request ID",
            value: selectedRequest.id.toString(),
          },
          { trait_type: "Backer Address", value: connectedAddress },
          { trait_type: "Backer GitHub Username", value: scoreData.username },
          {
            trait_type: "Backer GitHub Score (at vouch)",
            value: scoreData.totalScore.toFixed(1),
          },
          { trait_type: "Borrower Address", value: selectedRequest.borrower },
          {
            trait_type: "Borrower GitHub Score (at request)",
            value: (Number(selectedRequest.githubScore) / 10).toFixed(1),
          },
          { trait_type: "Stake Amount (PAS)", value: backerStakeAmount },
          {
            trait_type: "Vouch Duration (Days)",
            value: (Number(selectedRequest.duration) / (24 * 60 * 60)).toFixed(
              0
            ),
          },
          { trait_type: "Backer's Reason/Note", value: vouchReason },
        ],
      };
      const metadataCID = await uploadJsonToIPFS(vouchMetadata);
      if (!metadataCID) {
        setVouchFormError("Failed to upload metadata to IPFS.");
        setVouchFormMessage(null);
        return;
      }
      setVouchFormMessage(`Vouch metadata uploaded. Submitting transaction...`);
      executeVouchForRequest({
        address: REPUFI_SBT_CONTRACT_ADDRESS,
        abi: REPUFI_SBT_ABI,
        functionName: "vouchForRequest",
        args: [selectedRequest.borrower, metadataCID],
        value: stakeInWei,
      });
    } catch (err) {
      setVouchFormError(`Error: ${err.message}`);
      setVouchFormMessage(null);
    }
  };
  useEffect(() => {
    if (isVouchConfirmed) {
      setVouchFormMessage("Successfully vouched!");
      setVouchFormError(null);
      refetchRequestCounter().then(() => fetchAllOpenReputationRequests());
      setTimeout(() => {
        setSelectedRequest(null);
        setVouchFormMessage(null);
      }, 3500);
    }
    if (vouchWriteError) {
      setVouchFormError(`Tx Error: ${vouchWriteError.shortMessage}`);
      setVouchFormMessage(null);
    }
    if (vouchReceiptError) {
      setVouchFormError(`Confirm Error: ${vouchReceiptError.shortMessage}`);
      setVouchFormMessage(null);
    }
  }, [
    isVouchConfirmed,
    vouchWriteError,
    vouchReceiptError,
    fetchAllOpenReputationRequests,
    refetchRequestCounter,
  ]);
  const cardContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const renderUserStatusAndEligibility = () => {
    const loadingOrErrorBaseClass =
      "text-center p-8 bg-slate-900/70 border border-slate-700 backdrop-blur-sm rounded-2xl max-w-lg mx-auto";
    if (sessionStatus === "loading" || (isFetchingScore && !scoreData))
      return (
        <div className={loadingOrErrorBaseClass}>
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-cyan-400" />
          <p className="mt-3 font-semibold">Analyzing your profile...</p>
        </div>
      );
    if (fetchScoreError)
      return (
        <div className={`${loadingOrErrorBaseClass} border-red-500/30`}>
          <ShieldAlert className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h3 className="font-bold text-red-400">Analysis Error</h3>
          <p className="text-slate-300 text-sm">{fetchScoreError}</p>
          <Button
            onClick={() => refreshScore(session?.user?.githubUsername)}
            className="btn-secondary !mt-4"
          >
            Retry
          </Button>
        </div>
      );
    if (sessionStatus === "unauthenticated")
      return (
        <div className={loadingOrErrorBaseClass}>
          <Github className="h-12 w-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-2xl font-bold mb-2">Login Required</h3>
          <p className="text-slate-300 mb-6">
            Log in with GitHub to check your eligibility as a backer.
          </p>
          <Button
            onClick={() => signIn("github")}
            className="!bg-cyan-600 hover:!bg-cyan-500 text-white font-bold text-base"
          >
            <Github className="mr-2 h-5 w-5" /> Login with GitHub
          </Button>
        </div>
      );
    if (scoreData)
      return (
        <div className="max-w-xl mx-auto rounded-[22px] p-[1px] bg-gradient-to-br from-slate-600 via-slate-800 to-slate-900">
          <div className="rounded-[21px] bg-slate-900/90 p-6 text-center space-y-3">
            <h2 className="text-2xl font-semibold text-white">
              Backer Eligibility Status
            </h2>
            <p className="font-medium text-slate-300">
              GitHub Profile:{" "}
              <span className="font-bold text-white">{scoreData.username}</span>
            </p>
            <p className="text-slate-300">
              Analyzed Score:{" "}
              <strong className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-cyan-300 to-blue-400">
                {scoreData.totalScore.toFixed(1)}
              </strong>{" "}
              / 10
            </p>
            {isEligibleBacker ? (
              <div className="p-3 rounded-md text-sm bg-green-500/10 text-green-300 border border-green-500/20">
                <p className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={18} />
                  Eligible to be a backer! View requests below.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-md text-sm bg-red-500/10 text-red-300 border border-red-500/20">
                <p className="flex items-center justify-center gap-1.5">
                  <ShieldAlert size={18} />
                  Score is below {actualMinScoreThreshold.toFixed(1)}. You
                  cannot act as a backer.
                </p>
                <Link
                  href="/request-reputation"
                  className="mt-2 inline-block font-semibold text-cyan-400 hover:underline"
                >
                  Need a higher score? Request a vouch.
                </Link>
              </div>
            )}
          </div>
        </div>
      );
    return (
      <div className={loadingOrErrorBaseClass}>
        <Info size={40} className="mx-auto text-slate-500 mb-3" />
        <h3 className="text-xl font-bold">Awaiting Score</h3>
        <p className="text-slate-400">
          Your GitHub score is being processed. It should appear shortly.
        </p>
      </div>
    );
  };
  if (!isConnected)
    return (
      <div className="relative min-h-screen text-white overflow-hidden flex items-center justify-center p-4">
        <VantaDotsBackground />
        <div className="relative z-10 p-10 text-center bg-slate-900/80 border border-slate-700 backdrop-blur-md rounded-2xl max-w-md mx-auto">
          <LockKeyhole size={60} className="mx-auto text-cyan-400 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-slate-300 mb-6">
            Please connect your wallet to participate.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <VantaDotsBackground />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 container mx-auto p-4 sm:p-6 lg:p-8 space-y-12 pb-24"
      >
        <header className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Become a Backer
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Your GitHub score determines your eligibility to back other users.
            If your score is {actualMinScoreThreshold.toFixed(1)} or higher, you
            can vouch for open requests.
          </p>
        </header>

        {renderUserStatusAndEligibility()}

        {isEligibleBacker && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <h2 className="text-3xl font-bold text-white text-center sm:text-left">
                Open Reputation Requests ({reputationRequests.length})
              </h2>
              <Button
                onClick={fetchAllOpenReputationRequests}
                disabled={isLoadingRequests}
                className="btn-outline !bg-slate-800/80 !border-slate-700 hover:!bg-slate-700/80 mt-3 sm:mt-0"
              >
                <Loader2
                  className={`h-4 w-4 mr-2 ${
                    isLoadingRequests ? "animate-spin" : "hidden"
                  }`}
                />
                <RefreshCw
                  size={16}
                  className={`mr-2 ${
                    isLoadingRequests ? "hidden" : "inline-block"
                  }`}
                />{" "}
                Refresh
              </Button>
            </div>
            {isLoadingRequests && (
              <div className="text-center py-10">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-cyan-400" />
                <p className="mt-3">Loading open requests...</p>
              </div>
            )}
            {errorRequests && (
              <p className="text-red-400 text-center py-4">{errorRequests}</p>
            )}
            {!isLoadingRequests &&
              reputationRequests.length === 0 &&
              !errorRequests && (
                <div className="min-h-[30vh] flex flex-col justify-center items-center text-center p-10 bg-slate-900/70 border border-slate-700 backdrop-blur-sm rounded-2xl">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <Users size={52} className="mx-auto text-slate-500 mb-5" />
                  </motion.div>
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    No Open Requests
                  </h3>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    There are currently no reputation requests awaiting a
                    backer.
                  </p>
                </div>
              )}
            {reputationRequests.length > 0 && (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                variants={cardContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {reputationRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    handleOpenVouchModal={handleOpenVouchModal}
                  />
                ))}
              </motion.div>
            )}
          </motion.section>
        )}
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          title={`Vouch for Request #${selectedRequest?.id}`}
        >
          {selectedRequest && (
            <form onSubmit={handleVouchForRequestSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-slate-300">
                  Vouching for:{" "}
                  <strong className="font-mono block truncate text-xs my-1">
                    {selectedRequest.borrower}
                  </strong>
                </p>
                <p className="text-xs text-slate-400">
                  Their Score:{" "}
                  <strong>
                    {(Number(selectedRequest.githubScore) / 10).toFixed(1)}
                  </strong>{" "}
                  | Duration:{" "}
                  <strong>
                    {(
                      Number(selectedRequest.duration) /
                      (24 * 60 * 60)
                    ).toFixed(0)}{" "}
                    days
                  </strong>
                </p>
              </div>
              <div>
                <label
                  htmlFor="backerStakeAmountModal"
                  className="block text-sm font-medium mb-1 text-slate-300"
                >
                  Your Stake (PAS) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  id="backerStakeAmountModal"
                  value={backerStakeAmount}
                  onChange={(e) => setBackerStakeAmount(e.target.value)}
                  step="any"
                  placeholder="e.g., 0.05"
                  required
                  className="input w-full bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                />
              </div>    
              <div>
                <label
                  htmlFor="vouchReasonModal"
                  className="block text-sm font-medium mb-1 text-slate-300"
                >
                  Reason/Note (optional)
                </label>
                <Textarea
                  id="vouchReasonModal"
                  value={vouchReason}
                  onChange={(e) => setVouchReason(e.g.target.value)}
                  rows={3}
                  placeholder="Provide a brief reason for your vouch."
                  className="input w-full bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full btn-primary !py-2.5 !bg-cyan-600 hover:!bg-cyan-500"
                disabled={isVouchPending || isVouchConfirming}
              >
                {isVouchPending || isVouchConfirming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isVouchPending
                  ? "Awaiting Wallet..."
                  : isVouchConfirming
                  ? "Confirming Transaction..."
                  : "Confirm & Stake PAS"}
              </Button>
              {vouchFormMessage && (
                <p className="text-green-400 text-sm text-center mt-2">
                  {vouchFormMessage}
                </p>
              )}
              {vouchFormError && (
                <p className="text-red-400 text-sm text-center mt-2">
                  {vouchFormError}
                </p>
              )}
            </form>
          )}
        </Modal>
      </motion.main>
    </div>
  );
}