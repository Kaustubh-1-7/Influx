// app/(components)/VouchCard.jsx
'use client';

import { motion } from 'framer-motion';
import { ExternalLink, UserCircle, Users, CheckCircle, ShieldAlert, Clock, Loader2, GitBranch } from 'lucide-react';
import { FiDollarSign } from "react-icons/fi"; // Using react-icons for the dollar sign
import { Button } from './ui/Button';

// This is a sub-component for displaying metadata neatly
const InfoRow = ({ icon, label, value, isAddress = false, isCID = false }) => (
    <div className="flex items-start justify-between text-sm py-2 border-b border-white/5">
        <div className="flex items-center text-slate-400">
            {icon}
            <span className="ml-2">{label}</span>
        </div>
        {isAddress ? (
            <a href={`https://testnet.avascan.info/blockchain/c/address/${value}`} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-400 hover:text-cyan-300 truncate transition-colors">
                {`${value.substring(0, 6)}...${value.substring(value.length - 4)}`}
            </a>
        ) : isCID ? (
             <a href={`https://ipfs.io/ipfs/${value}`} target="_blank" rel="noopener noreferrer" className="font-mono text-purple-400 hover:text-purple-300 truncate transition-colors">
                {`${value.substring(0, 6)}...`} <ExternalLink size={12} className="inline-block ml-1" />
            </a>
        ) : (
            <span className="font-medium text-white text-right">{value}</span>
        )}
    </div>
);

export function VouchCard({ vouch, isAdmin, handleAction, isActionPending, isActionConfirming, actionTokenId }) {
    const isThisCardInAction = (isActionPending || isActionConfirming) && actionTokenId === vouch.id;

    // Determine the role and status for the card's header
    const getRoleAndStatus = () => {
        if (vouch.isMyVouchAsBacker) return { role: 'You are the Backer', icon: <UserCircle className="text-cyan-400" size={24} /> };
        if (vouch.isMyVouchAsBorrower) return { role: 'You are the Borrower', icon: <Users className="text-purple-400" size={24} /> };
        return { role: 'Vouch', icon: <UserCircle size={24} /> };
    };
    const { role, icon } = getRoleAndStatus();

    return (
        <motion.div
            layout
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-lg transition-all duration-300 hover:border-white/20"
        >
            {/* --- Card Header --- */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-bold text-lg text-white">{role}</span>
                </div>
                <div className="text-xs font-mono px-2 py-1 rounded bg-black/20 text-slate-400">
                    ID: {vouch.id}
                </div>
            </div>

            {/* --- Card Body with Vouch Details --- */}
            <div className="flex-grow space-y-1 mb-6">
                <InfoRow icon={<GitBranch size={16} />} label="Reason" value={vouch.reason || 'N/A'} />
                <InfoRow icon={<UserCircle size={16} />} label="Backer" value={vouch.backer} isAddress={true} />
                <InfoRow icon={<Users size={16} />} label="Borrower" value={vouch.borrower} isAddress={true} />
                <InfoRow icon={<Clock size={16} />} label="Expires" value={vouch.expiryDate} />
                {/* === ICON UPDATED HERE === */}
                <InfoRow icon={<FiDollarSign size={16} />} label="Amount Staked" value={`${vouch.amount} PAS`} />
                {vouch.metadataCID && <InfoRow icon={<ExternalLink size={16} />} label="Metadata" value={vouch.metadataCID} isCID={true} />}
            </div>

            {/* --- Card Footer with Status and Actions --- */}
            <div className="mt-auto pt-4">
                {/* Status Badge */}
                <div className={`flex items-center justify-center p-2 rounded-md text-sm font-semibold mb-4 ${
                    vouch.isExpired ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
                }`}>
                    {vouch.isExpired ? <ShieldAlert size={16} className="mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                    Status: {vouch.withdrawn ? 'Withdrawn' : vouch.isExpired ? 'Expired' : 'Active'}
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vouch.isMyVouchAsBacker && !vouch.isExpired && (
                        <Button onClick={() => handleAction('expireVouch', vouch.id)} disabled={isThisCardInAction} className="btn-vouch-action !bg-yellow-600/80 hover:!bg-yellow-600">
                            {isThisCardInAction ? <Loader2 className="animate-spin" /> : 'Expire Early'}
                        </Button>
                    )}
                    {vouch.isMyVouchAsBacker && vouch.isExpired && !vouch.withdrawn && (
                        <Button onClick={() => handleAction('releaseStake', vouch.id)} disabled={isThisCardInAction} className="btn-vouch-action !bg-green-600/80 hover:!bg-green-600">
                            {isThisCardInAction ? <Loader2 className="animate-spin" /> : 'Release Stake'}
                        </Button>
                    )}
                    {/* {isAdmin && !vouch.isExpired && (
                         <Button onClick={() => handleAction('slashStake', vouch.id)} disabled={isThisCardInAction} className="btn-vouch-action !bg-red-600/80 hover:!bg-red-600">
                            {isThisCardInAction ? <Loader2 className="animate-spin" /> : 'Slash Stake (Admin)'}
                        </Button>
                    )} */}
                </div>
            </div>
        </motion.div>
    );
}