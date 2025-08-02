// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BattleGame is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct UserProfile {
        string name;
        uint256 exp;
        uint256 level;
        uint256 trophies;
        uint256 battlesWon;
        uint256 nftsOwned;
        uint256 league;            // 0=None, 1=Peasant...6=Divine
        uint256 battleMultiplier;  // x10 (e.g., 12 = 1.2x)
        bool exists;
    }
    struct NFTStats {
        uint256 atk;
        uint256 def;
        uint256 hp;
        uint256 critRate;
        uint256 levelMinted;
    }
    struct Crate {
        string crateType;
        uint256 rarity; // 0=Basic, 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary
        bool claimed;
    }

    mapping(address => UserProfile) public userProfiles;
    mapping(address => uint256[]) public userOwnedNFTs;
    mapping(address => Crate[]) public userCrates;
    mapping(uint256 => NFTStats) public nftStats;

    string[] public leagueNames = ["None","Peasant","Awakened","Ascended","Transcendent","Supreme","Divine"];
    string[] public crateNames = ["Basic","Uncommon","Rare","Epic","Legendary"];
    uint8 public constant MAX_LEAGUE = 6;
    uint8 public constant LEVELS_PER_NFT = 10;
    uint256[] public leagueTrophyThresholds = [0, 0, 100, 250, 500, 1000, 2000]; // index 0=unused
    uint256[] public trophyGainPerWin = [0, 15, 12, 10, 8, 5, 3];
    uint256[] public trophyLossPerDefeat = [0, 5, 7, 9, 12, 15, 18];

    event ProfileCreated(address indexed, string);
    event LevelUp(address indexed, uint256, uint256);
    event NFTMinted(address indexed, uint256, uint256);
    event CrateAwarded(address indexed, string, uint256, uint256);
    event CrateClaimed(address indexed, uint256, string);
    event LeagueChanged(address indexed, uint256, string);

    modifier hasProfile() {
        require(userProfiles[msg.sender].exists, "Profile does not exist");
        _;
    }

    constructor() ERC721("BattleGameHeroNFT", "BGHNFT") Ownable(msg.sender) {}

    // ---- PROFILE CREATION ----
    function createProfile(string calldata _name) external {
        require(!userProfiles[msg.sender].exists, "Already has a profile");
        userProfiles[msg.sender] = UserProfile({
            name: _name,
            exp: 10,
            level: 1,
            trophies: 0,
            battlesWon: 0,
            nftsOwned: 0,
            league: 1,
            battleMultiplier: 10,
            exists: true
        });
        // Only here: auto-mint first NFT
        mintNFT(1);
        emit ProfileCreated(msg.sender, _name);
    }

    // ---- BATTLE, EXP, TROPHIES, LEAGUE ----
    function recordBattleResult(bool isWin) external hasProfile {
        UserProfile storage user = userProfiles[msg.sender];

        // Battle and EXP
        uint256 baseExp = 5 + (user.league * 2);
        if (isWin) {
            user.battlesWon += 1;
            baseExp += 3;
            user.trophies += trophyGainPerWin[user.league];
        } else {
            uint256 loss = trophyLossPerDefeat[user.league];
            if (user.trophies > loss) {
                user.trophies -= loss;
            } else {
                user.trophies = 0;
            }
        }
        user.exp += baseExp;

        // Level up
        uint256 expForNext = 10 + (user.level * 5);
        uint256 newLevel = user.level;
        while (user.exp >= expForNext && newLevel < 100) {
            user.exp -= expForNext;
            newLevel++;
            expForNext = 10 + (newLevel * 5);
        }
        if (newLevel > user.level) {
            for (uint256 l = user.level + 1; l <= newLevel; l++) {
                _levelUp(msg.sender, l);
            }
        }
        _checkAndUpdateLeague(user, msg.sender);
    }

    function _checkAndUpdateLeague(UserProfile storage user, address userAddr) internal {
        uint256 newLeague = user.league;
        // Upgrade
        while (newLeague < leagueTrophyThresholds.length-1 && user.trophies >= leagueTrophyThresholds[newLeague+1]) {
            newLeague++;
        }
        // Downgrade
        while (newLeague > 1 && user.trophies < leagueTrophyThresholds[newLeague]) {
            newLeague--;
        }
        if (newLeague != user.league) {
            user.league = newLeague;
            string memory crateType = crateNames[newLeague > crateNames.length-1 ? crateNames.length-1 : newLeague-1];
            userCrates[userAddr].push(Crate(crateType, newLeague-1, false));
            emit LeagueChanged(userAddr, newLeague, crateType);
            emit CrateAwarded(userAddr, crateType, newLeague-1, newLeague);
        }
    }

    function _levelUp(address userAddr, uint256 newLevel) internal {
        UserProfile storage user = userProfiles[userAddr];
        user.level = newLevel;
        user.battleMultiplier = 10 + (newLevel - 1);
        emit LevelUp(userAddr, newLevel, user.battleMultiplier);
    }

    // ---- CLAIM CRATE: "claim" a crate, but must mint NFT separately ----
    function claimCrate(uint256 crateIndex) external hasProfile {
        require(crateIndex < userCrates[msg.sender].length, "Bad crate index");
        Crate storage crate = userCrates[msg.sender][crateIndex];
        require(!crate.claimed, "Already claimed");
        crate.claimed = true;
        emit CrateClaimed(msg.sender, crateIndex, crate.crateType);
        // NO NFT minted here; must call mintNFT explicitly
    }

    // ---- MINT NFT: PUBLIC, USER-INITIATED (e.g., from frontend button) ----
    function mintNFT(uint256 atLevel) public hasProfile {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _safeMint(msg.sender, newTokenId);

        NFTStats memory stats = _getNFTStatsForLevel(atLevel);
        nftStats[newTokenId] = stats;
        userProfiles[msg.sender].nftsOwned++;
        userOwnedNFTs[msg.sender].push(newTokenId);

        emit NFTMinted(msg.sender, newTokenId, atLevel);
    }

    function _getNFTStatsForLevel(uint256 level) internal pure returns (NFTStats memory) {
        if (level == 1) return NFTStats(5,5,20,200,level);
        if (level == 10) return NFTStats(8,8,30,300,level);
        if (level == 20) return NFTStats(14,14,50,400,level);
        if (level == 30) return NFTStats(24,24,85,500,level);
        return NFTStats(5+(level-1)*2,5+(level-1)*2,20+(level-1)*3,200+(level-1)*10,level);
    }

    // ---- VIEWS ----
    function getUserProfile(address user) external view returns (UserProfile memory) {
        return userProfiles[user];
    }
    function getUserNFTs(address user) external view returns (uint256[] memory) {
        return userOwnedNFTs[user];
    }
    function getUserCrates(address user) external view returns (Crate[] memory) {
        return userCrates[user];
    }
}
