// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RepuFiSBT is ERC721, Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant REPUTATION_REQUEST_FEE = 0.0001 ether;
    uint256 public constant MIN_GITHUB_SCORE = 7;
    uint256 public constant CHALLENGE_STAKE = 0.0015 ether;
    
    // Struct to store vouch information
    struct Vouch {
        address backer;
        address borrower;
        uint128 amount;         // Staked ETH amount (wei)
        uint256 expiry;          // Expiration timestamp
        bool withdrawn;         // Whether stake has been withdrawn
        uint256 pairedTokenId;  // Linked token ID
        bool forceExpired;      // Admin-forced expiration
        string metadataCID;    // IPFS content identifier
    }
    
    // Reputation request struct
    struct ReputationRequest {
        address borrower;
        string requestType;
        string description;
        uint256 duration;
        uint256 timestamp;
        string metadataCID;
        bool fulfilled;
        uint256 githubScore;
        uint256 borrowerStake;
    }
    
    // Challenge struct and enums
    enum ChallengeStatus { Pending, Accepted, Rejected }
    struct Challenge {
        uint256 vouchTokenId;
        address challenger;
        uint256 stakedAmount;
        uint256 timestamp;
        string challengeReason;
        ChallengeStatus status;
        bool processed;
    }

    // State variables
    uint256 public tokenIdCounter;
    uint256 public maxDuration = 15 days;
    uint256 public reputationRequestCounter;
    uint256 public challengeCounter;

    // Mappings
    mapping(uint256 => address) public tokenOwners;
    mapping(uint256 => Vouch) public vouches;
    mapping(address => uint256[]) public ownedSBTs;
    mapping(uint256 => uint256) public tokenPairs;
    mapping(uint256 => ReputationRequest) public reputationRequests;
    mapping(address => uint256[]) public userReputationRequests;
    mapping(address => uint256) public githubScores;
    mapping(address => uint256) public tokenIds;
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => uint256[]) public vouchChallenges;

    // Events
    event VouchCreated(
        uint256 indexed backerTokenId,
        uint256 indexed borrowerTokenId,
        address indexed backer,
        address borrower,
        uint256 amount,
        uint256 expiry,
        string metadataCID
    );
    event StakeReleased(uint256 tokenId, address backer, uint256 amount);
    event StakeSlashed(uint256 tokenId, address backer, address borrower, uint256 amount);
    event VouchForceExpired(uint256 tokenId, uint256 pairedTokenId);
    event MaxDurationUpdated(uint256 newDuration);
    event SBTPermanentlyBurned(uint256 tokenId, uint256 pairedTokenId);
    event ReputationRequestCreated(
        uint256 indexed requestId,
        address indexed borrower,
        string requestType,
        string description,
        uint256 duration,
        uint256 fee,
        uint256 githubScore,
        uint256 borrowerStake
    );
    event ReputationRequestFulfilled(
        uint256 indexed requestId,
        uint256 indexed vouchTokenId,
        address backer
    );
    event ChallengeCreated(
        uint256 indexed challengeId,
        uint256 indexed vouchTokenId,
        address indexed challenger,
        uint256 stakedAmount,
        string reason
    );
    event ChallengeProcessed(
        uint256 indexed challengeId,
        ChallengeStatus status,
        address challenger,
        uint256 refund,
        uint256 reward
    );

    // Errors
    error InvalidAddress();
    error InsufficientStake();
    error NotAuthorized();
    error AlreadyProcessed();
    error VouchNotExpired();
    error InvalidBorrower();
    error GitHubScoreTooHigh();
    error InsufficientFee();
    error RequestNotFound();
    error RequestAlreadyFulfilled();
    error ChallengeNotFound();
    error ChallengeAlreadyProcessed();

    constructor() ERC721("VouchSBT", "VSBT") Ownable(msg.sender) {}

    // ===================== Reputation Request Functions =====================
    function setGitHubScore(address user, uint256 score) external onlyOwner {
        githubScores[user] = score;
    }

    function createReputationRequest(
        string calldata requestType,
        string calldata description, 
        uint256 duration,
        string calldata metadataCID,
        uint256 borrowerGithubScore
    ) external payable {
        if (borrowerGithubScore >= MIN_GITHUB_SCORE) revert GitHubScoreTooHigh();
        if (msg.value < REPUTATION_REQUEST_FEE) revert InsufficientFee();

        uint256 requestId = ++reputationRequestCounter;
        tokenIds[msg.sender] = requestId;
        reputationRequests[requestId] = ReputationRequest({
            borrower: msg.sender,
            requestType: requestType,
            description: description,
            duration: duration,
            timestamp: block.timestamp,
            metadataCID: metadataCID,
            fulfilled: false,
            githubScore: borrowerGithubScore,
            borrowerStake: msg.value
        });

        userReputationRequests[msg.sender].push(requestId);
        
        emit ReputationRequestCreated(
            requestId,
            msg.sender,
            requestType,
            description,
            duration,
            msg.value,
            borrowerGithubScore,
            msg.value
        );
    }

    function vouchForRequest(address borrower, string calldata metadataCID) external payable {
        uint256 requestId = tokenIds[borrower];
        ReputationRequest storage request = reputationRequests[requestId];
        if (request.borrower == address(0)) revert RequestNotFound();
        if (request.fulfilled) revert RequestAlreadyFulfilled();
        if (msg.value == 0) revert InsufficientStake();

        request.fulfilled = true;
        _createVouch(request.borrower, request.duration, metadataCID);

        emit ReputationRequestFulfilled(requestId, tokenIdCounter - 1, msg.sender);
    }

    // ===================== Challenge Functions =====================
    function createChallenge(uint256 vouchTokenId, string calldata challengeReason) external payable {
        require(_exists(vouchTokenId) ,"Token doesnt exist" );
        if (msg.value < CHALLENGE_STAKE) revert InsufficientStake();
        

        Vouch storage vouch = vouches[vouchTokenId];
        if (vouch.withdrawn || vouch.forceExpired) revert("Cannot challenge expired/withdrawn vouch");

        uint256 challengeId = ++challengeCounter;
        challenges[challengeId] = Challenge({
            vouchTokenId: vouchTokenId,
            challenger: msg.sender,
            stakedAmount: CHALLENGE_STAKE,
            timestamp: block.timestamp,
            challengeReason: challengeReason,
            status: ChallengeStatus.Pending,
            processed: false
        });

        vouchChallenges[vouchTokenId].push(challengeId);
        
        emit ChallengeCreated(
            challengeId,
            vouchTokenId,
            msg.sender,
            msg.value,
            challengeReason
        );
    }

    function processChallenge(uint256 challengeId, bool accept) external onlyOwner {
        Challenge storage challenge = challenges[challengeId];
        
        if (challenge.challenger == address(0)) revert ChallengeNotFound();
        if (challenge.processed) revert ChallengeAlreadyProcessed();

        challenge.status = accept ? ChallengeStatus.Accepted : ChallengeStatus.Rejected;
        challenge.processed = true;

        uint256 refund = 0;
        uint256 reward = 0;

        if (accept) {
            Vouch storage vouch = vouches[challenge.vouchTokenId];
            
            refund = challenge.stakedAmount;
            reward = vouch.amount / 4;
            
            uint256 backerRefund = vouch.amount / 2;
            
            vouch.withdrawn = true;
            vouches[vouch.pairedTokenId].withdrawn = true;

            (bool success1,) = challenge.challenger.call{value: refund + reward}("");
            require(success1, "Challenger payment failed");
            
            (bool success2,) = vouch.backer.call{value: backerRefund}("");
            require(success2, "Backer refund failed");

        } else {
            refund = 0;
            (bool success,) = challenge.challenger.call{value: refund}("");
            require(success, "Refund failed");
        }

        emit ChallengeProcessed(challengeId, challenge.status, challenge.challenger, refund, reward);
    }

    // ===================== Vouch Creation Functions =====================
    function _createVouch(address borrower, uint256 duration, string memory metadataCID) internal {
        if (borrower == address(0)) revert InvalidAddress();
        if (borrower == msg.sender) revert InvalidBorrower();
        if (duration > maxDuration) duration = maxDuration;

        uint256 expiry = block.timestamp + duration;
        uint256 backerTokenId = ++tokenIdCounter;
        uint256 borrowerTokenId = ++tokenIdCounter;

        // Create vouch records
        vouches[backerTokenId] = Vouch({
            backer: msg.sender,
            borrower: borrower,
            amount: uint128(msg.value),
            expiry: (expiry),
            withdrawn: false,
            pairedTokenId: borrowerTokenId,
            forceExpired: false,
            metadataCID: metadataCID
        });

        vouches[borrowerTokenId] = Vouch({
            backer: msg.sender,
            borrower: borrower,
            amount: uint128(msg.value),
            expiry: (expiry),
            withdrawn: false,
            pairedTokenId: backerTokenId,
            forceExpired: false,
            metadataCID: metadataCID
        });

        // Mint SBTs to both parties
        _safeMint(msg.sender, backerTokenId);
        _safeMint(borrower, borrowerTokenId);

        // Track ownership
        ownedSBTs[msg.sender].push(backerTokenId);
        ownedSBTs[borrower].push(borrowerTokenId);

        // Create token pair reference
        tokenPairs[backerTokenId] = borrowerTokenId;
        tokenPairs[borrowerTokenId] = backerTokenId;

        tokenOwners[backerTokenId] = msg.sender;
        tokenOwners[borrowerTokenId] = borrower;

        emit VouchCreated(
            backerTokenId,
            borrowerTokenId,
            msg.sender,
            borrower,
            msg.value,
            expiry,
            metadataCID
        );
    }

    // ===================== Core SBT Functions =====================
    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenOwners[tokenId] != address(0);
    }

    function releaseStake(uint256 tokenId) external nonReentrant {
        Vouch storage v = vouches[tokenId];
        
        // Validate
        if (!_exists(tokenId)) revert InvalidAddress();
        if (v.withdrawn) revert AlreadyProcessed();
        if (block.timestamp <= v.expiry && !v.forceExpired) revert VouchNotExpired();
        if (msg.sender != v.backer && msg.sender != owner()) revert NotAuthorized();

        // Mark both tokens as withdrawn
        v.withdrawn = true;
        vouches[v.pairedTokenId].withdrawn = true;

        // Transfer staked ETH
        (bool success, ) = v.backer.call{value: v.amount+(REPUTATION_REQUEST_FEE/2)}("");
        require(success, "Transfer failed");

        emit StakeReleased(tokenId, v.backer, v.amount);
    }

    function slashStake(uint256 tokenId) external onlyOwner {
        Vouch storage v = vouches[tokenId];
        
        if (!_exists(tokenId)) revert InvalidAddress();
        if (v.withdrawn) revert AlreadyProcessed();

        v.withdrawn = true;
        vouches[v.pairedTokenId].withdrawn = true;

        emit StakeSlashed(tokenId, v.backer, v.borrower, v.amount);
    }

    function forceExpire(uint256 tokenId) external onlyOwner {
        Vouch storage v1 = vouches[tokenId];
        
        if (!_exists(tokenId)) revert InvalidAddress();
        if (v1.forceExpired) revert AlreadyProcessed();

        Vouch storage v2 = vouches[v1.pairedTokenId];
        
        // Mark as expired
        v1.forceExpired = true;
        v2.forceExpired = true;

        // Get owners before burning
        address backerOwner = ownerOf(tokenId);
        address borrowerOwner = ownerOf(v1.pairedTokenId);

        // Permanently burn both SBTs
        _burn(tokenId);
        _burn(v1.pairedTokenId);

        // Clean up ownership tracking
        _removeFromOwned(backerOwner, tokenId);
        _removeFromOwned(borrowerOwner, v1.pairedTokenId);

        emit VouchForceExpired(tokenId, v1.pairedTokenId);
        emit SBTPermanentlyBurned(tokenId, v1.pairedTokenId);
    }

    function _removeFromOwned(address owner, uint256 tokenId) internal {
        uint256[] storage tokens = ownedSBTs[owner];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                if (i != tokens.length - 1) {
                    tokens[i] = tokens[tokens.length - 1];
                }
                tokens.pop();
                break;
            }
        }
    }

    // View functions
    
    function isExpired(uint256 tokenId) public view returns(bool){
        require(_exists(tokenId),"Token doesnt exist");
        return block.timestamp >= vouches[tokenId].expiry;
    }

    function getVouchDetails(uint256 tokenId) external view returns (Vouch memory) {
        require(_exists(tokenId), "Invalid token");
        return vouches[tokenId];
    }

    function getOwnedSBTs(address owner) external view returns (uint256[] memory) {
        return ownedSBTs[owner];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Nonexistent token");
        return string(abi.encodePacked("ipfs://", vouches[tokenId].metadataCID));
    }

    // Overrides to make SBT non-transferable
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Disallow transfers between non-zero addresses
        if (from != address(0) && to != address(0)) {
            revert("Non-transferable SBT");
        }
        
        return super._update(to, tokenId, auth);
    }

    function _ownerOf(uint256 tokenId) internal view virtual override returns (address) {
        return tokenOwners[tokenId];
    }


}