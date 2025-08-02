// app/faq/page.jsx
import { HelpCircle, ShieldCheck, Users, UserCheck , Coins ,GitBranch, AlertTriangle, Zap, Handshake } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
    title: 'FAQ - RepuFi',
    description: 'Frequently Asked Questions about RepuFi, the decentralized reputation lending market.',
};

const FAQItem = ({ question, children }) => (
    <details className="group rounded-lg bg-slate-50 dark:bg-slate-800/50 p-5 shadow-sm border border-border dark:border-dark-border open:ring-1 open:ring-primary open:shadow-lg transition-all">
        <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-medium text-foreground group-open:text-primary">
            {question}
            <div className="text-slate-500 dark:text-slate-400 group-open:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="block h-5 w-5 group-open:hidden">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="hidden h-5 w-5 group-open:block">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
            </div>
        </summary>
        <div className="mt-4 text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            {children}
        </div>
    </details>
);

export default function FAQPage() {
  return (
    <div className="animate-fadeIn space-y-10">
      <div className="text-center pt-4 pb-8">
        <HelpCircle className="h-16 w-16 mx-auto text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">Frequently Asked Questions</h1>
        <p className="text-lg text-slate-300 dark:text-slate-500 max-w-2xl mx-auto">
          Find answers to common questions about RepuFi, its purpose, and how it works.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        <FAQItem question="What is RepuFi and what problem does it solve?">
          <p>
            RepuFi is a decentralized reputation lending market. In the Web3 space, new users or developers often struggle to prove their credibility, hindering their access to opportunities like grants, DAO roles, or collaborations.
            RepuFi addresses this by allowing individuals with established off-chain reputation (like GitHub activity) to vouch for others by staking tokens (PAS on PassetHub Testnet).
          </p>
          <p className="mt-2">
            This creates a system where **Backers** can leverage their trust to empower **Borrowers**, who in turn receive a verifiable on-chain "VouchSBT" (a Soul-Bound Token) to showcase this endorsement.
          </p>
        </FAQItem>

        <FAQItem question="Can anyone just enter someone else's GitHub username to become a Backer?">
            <div className="flex items-start space-x-3">
                <div>
                    <p>
                        This is a valid concern for a system aiming for high trust. In the current MVP:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
                        <li>
                            The GitHub username is provided by the user wanting to become a Backer. The system analyzes that profile to generate a score.
                        </li>
                        <li>
                            The VouchSBT metadata includes this claimed GitHub username and the associated score. This information is public and transparent.
                        </li>
                        <li>
                            Verification & Mitigation : While the smart contract itself doesn't perform verification of GitHub ownership . If a Borrower or another party suspects a Backer has falsely claimed a GitHub profile:
                            <ul className="list-circle list-inside ml-4 mt-1 space-y-1">
                                <li>They can report it to the RepuFi DAO/Admin.</li>
                                <li>The Admin contract owner has the authority to investigate. If misuse is confirmed , the Admin can slash expire on any vouches made by that fraudulent Backer. This would burn the associated VouchSBTs and potentially allow staked funds to be handled appropriately .</li>
                            </ul>
                        </li>
                        <li>
                            Gas Efficiency: The current mvp is significantly more gas-efficient than attempting any form of direct on-chain GitHub data fetching or complex verification, making the system more accessible on networks like PassetHub.
                        </li>
                        
                    </ul>
                </div>
            </div>
        </FAQItem>

        <FAQItem question="Who are Backers and Borrowers?">
            <div className="flex items-start space-x-3 mb-3">
                <UserCheck className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                    <h4 className="font-semibold">Backers (Vouch-ers)</h4>
                    <p className="text-sm">These are users with a demonstrable reputation, particularly from their GitHub activity. They use RepuFi to analyze their GitHub profile, generate a Developer Reputation Score (DRS), and if eligible (score ≥ 7), they can stake PAS tokens to vouch for Borrowers they trust.</p>
                </div>
            </div>
            <div className="flex items-start space-x-3">
                <Users className="h-6 w-6 text-secondary flex-shrink-0 mt-1" />
                <div>
                    <h4 className="font-semibold">Borrowers</h4>
                    <p className="text-sm">These are individuals (new developers, community members, artists, etc.) who may have limited on-chain history but possess skills and potential. They seek vouches from Backers to gain access to opportunities that require a degree of trust or verified credibility.</p>
                </div>
            </div>
        </FAQItem>

        <FAQItem question="How does the GitHub reputation scoring work?">
          <p>
            When a user intends to become a Backer, they provide their GitHub username to RepuFi. Our system then (via a server-side API route for security and to handle API keys) fetches public data from their GitHub profile, including:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Number of public repositories</li>
            <li>Follower count</li>
            <li>Total stars and forks received on their repositories</li>
            <li>Account age</li>
            <li>Recent commit activity (in their owned repositories)</li>
            <li>Total Pull Requests and Issues they've created</li>
            <li>PRs contributed to other repositories</li>
            <li>Profile completeness and language diversity</li>
          </ul>
          <p className="mt-2">
            This data is fed into a weighted algorithm to calculate a Developer Reputation Score (DRS) out of 10. A minimum score (currently 7) is required to be eligible to vouch for others. This score, along with key stats, is included in the VouchSBT metadata.
          </p>
        </FAQItem>

        <FAQItem question="What is a VouchSBT?">
          <ShieldCheck className="inline h-5 w-5 mr-1 text-primary" />
          <p>
            A VouchSBT is an ERC721 Soul-Bound Token (non-transferable NFT) minted on the PassetHub Testnet. When a Backer successfully vouches for a Borrower:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Both the Backer and the Borrower receive a paired VouchSBT.</li>
            <li>This SBT acts as an on-chain, verifiable proof of the vouch.</li>
            <li>Its metadata, stored on IPFS, includes details like the Backer's address, Borrower's address, staked PAS amount, reason for vouch, expiry date, and a snapshot of the Backer's GitHub reputation stats at the time of vouching.</li>
            <li>Borrowers can use this SBT as a "badge of trust" when applying for opportunities.</li>
          </ul>
        </FAQItem>

        <FAQItem question="What happens to the staked PAS tokens?">
          <Coins className="inline h-5 w-5 mr-1 text-yellow-500" />
          <p>
            The PAS tokens staked by the Backer serve as collateral.
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>If the Borrower acts responsibly</strong> and the vouch period expires without issues (or if the Borrower achieves a predefined goal related to the vouch), the Backer can reclaim their full staked amount using the `releaseStake` function.</li>
            <li><strong>If the Borrower misbehaves</strong> or fails to meet the vouch conditions (e.g., abuses a grant), a designated Admin (currently the contract owner) can trigger the `slashStake` function. In this scenario, the Backer's staked PAS tokens are slashed (currently remain in the contract, future iterations could send them to a treasury or burn them).</li>
          </ul>
        </FAQItem>

        

        <FAQItem question="Why build on PassetHub with Solidity?">
            <div className="flex items-start space-x-3">
                <Zap className="h-6 w-6 text-purple-500 flex-shrink-0 mt-1" />
                <div>
                    <p>
                        PassetHub, part of the Polkadot ecosystem, now supports EVM compatibility via PolkaVM. This offers several advantages:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li><strong>Asset Management Focus:</strong> AssetHub is designed for efficient creation and management of fungible and non-fungible assets (like our VouchSBTs).</li>
                        <li><strong>PolkaVM Advantages:</strong> Potentially faster compilation, reduced word size, larger contract size limits compared to standard EVMs, and multi-dimensional gas, opening new possibilities for complex applications.</li>
                    </ul>
                    
                </div>
            </div>
        </FAQItem>

        <FAQItem question="What's next for RepuFi?">
            <p>
                We're excited about the potential of RepuFi! Future plans include:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Implementing a Borrower-initiated vouch request system.</li>
                <li>Developing a Trust Marketplace where Backers can offer their vouching services.</li>
                <li>Integrating more reputation sources with Gitcoin, Lens, on-chain activity.</li>
                <li>SBTs could unlock specific platform features or DAO voting rights.</li>
            </ul>
            
        </FAQItem>

      </div>
      <div className="text-center mt-12">
        <p className="text-slate-600 dark:text-slate-500">Still have questions?</p>
        <Link href="https://github.com/bansal-ishaan/Repu-Fi/issues" target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-2 !border-primary !text-primary hover:!bg-primary/10">
            Ask on GitHub Issues
        </Link>
      </div>
    </div>
  );
}