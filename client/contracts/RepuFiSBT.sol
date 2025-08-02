// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RepuFiSBT is ERC721, Ownable, ReentrancyGuard {
    // Struct to store vouch information
    struct Vouch {
        address backer;
        address borrower;
        uint128 amount;         // Staked ETH amount (wei)
        uint64 expiry;          // Expiration timestamp
        bool withdrawn;         // Whether stake has been withdrawn
        uint256 pairedTokenId;  // Linked token ID
        bool forceExpired;      // Admin-forced expiration
        string metadataCID;    // IPFS content identifier
    }

    // State variables
    uint256 public tokenIdCounter;
    uint256 public maxDuration = 15 days; // Configurable max vouch duration

    // Mappings
    mapping(uint256 => address) public tokenOwners;
    mapping(uint256 => Vouch) public vouches;
    mapping(address => uint256[]) public ownedSBTs;
    mapping(uint256 => uint256) public tokenPairs;

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

    // Errors
    error InvalidAddress();
    error InsufficientStake();
    error NotAuthorized();
    error AlreadyProcessed();
    error VouchNotExpired();
    error InvalidBorrower();

    constructor() ERC721("VouchSBT", "VSBT") Ownable(msg.sender) {}

    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenOwners[tokenId] != address(0);
    }

    function createVouch(
        address borrower,
        uint256 duration,
        string calldata metadataCID
    ) external payable nonReentrant {
        // Fixed validation logic
        if (borrower == address(0)) revert InvalidAddress();
        if (borrower == msg.sender) revert InvalidBorrower(); // Can't vouch for yourself
        if (msg.value == 0) revert InsufficientStake(); // Need to stake ETH

        if (duration > maxDuration) duration = maxDuration;

        uint256 expiry = block.timestamp + duration;
        uint256 backerTokenId = ++tokenIdCounter;
        uint256 borrowerTokenId = ++tokenIdCounter;

        // Create vouch records
        vouches[backerTokenId] = Vouch({
            backer: msg.sender,
            borrower: borrower,
            amount: uint128(msg.value),
            expiry: uint64(expiry),
            withdrawn: false,
            pairedTokenId: borrowerTokenId,
            forceExpired: false,
            metadataCID: metadataCID
        });

        vouches[borrowerTokenId] = Vouch({
            backer: msg.sender,
            borrower: borrower,
            amount: uint128(msg.value),
            expiry: uint64(expiry),
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

    /**
     * @dev Releases staked ETH after vouch expiration
     * @param tokenId ID of the vouch SBT
     */
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
        (bool success, ) = v.backer.call{value: v.amount}("");
        require(success, "Transfer failed");

        emit StakeReleased(tokenId, v.backer, v.amount);
    }

    /**
     * @dev Admin function to slash stake (for defaults)
     * @param tokenId ID of the vouch SBT
     */
    function slashStake(uint256 tokenId) external onlyOwner {
        Vouch storage v = vouches[tokenId];
        
        if (!_exists(tokenId)) revert InvalidAddress();
        if (v.withdrawn) revert AlreadyProcessed();

        v.withdrawn = true;
        vouches[v.pairedTokenId].withdrawn = true;

        emit StakeSlashed(tokenId, v.backer, v.borrower, v.amount);
    }

    /**
     * @dev Admin function to force-expire a vouch
     * @param tokenId ID of the vouch SBT
     */
    function forceExpire(uint256 tokenId) external onlyOwner {
        Vouch storage v1 = vouches[tokenId];
        
        if (!_exists(tokenId)) revert InvalidAddress();
        if (v1.forceExpired) revert AlreadyProcessed();

        Vouch storage v2 = vouches[v1.pairedTokenId];
        
        // Mark as expired
        v1.forceExpired = true;
        v2.forceExpired = true;

        // Get owners before burning - Fixed to use ownerOf() instead of _ownerOf()
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
    function isExpired(uint256 tokenId) public view returns (bool) {
        require(_exists(tokenId), "Invalid token");
        Vouch storage v = vouches[tokenId];
        return block.timestamp > v.expiry || v.forceExpired;
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

    // Overrides to make SBT non-transferable - Fixed for OpenZeppelin v5
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

    // Fixed _ownerOf to use the correct OpenZeppelin function
    function _ownerOf(uint256 tokenId) internal view virtual override returns (address) {
        return tokenOwners[tokenId];
    }

    function approve(address, uint256) public pure override {
        revert("Approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Approvals disabled");
    }

    // Admin functions
    function setMaxDuration(uint256 newDuration) external onlyOwner {
        maxDuration = newDuration;
        emit MaxDurationUpdated(newDuration);
    }

    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}