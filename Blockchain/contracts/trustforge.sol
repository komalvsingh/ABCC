// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustForge
 * @dev Trust-based, collateral-free micro-lending platform
 * Key Features: Wallet Maturity + Behavior Trust + DAO Governance + User-Selected Duration
 */
contract TrustForge is ReentrancyGuard, Pausable, Ownable {
    
    // ============ State Variables ============
    
    IERC20 public lendingToken;
    
    // Trust score constants
    uint256 public constant INITIAL_TRUST_SCORE = 100;
    uint256 public constant MAX_TRUST_SCORE = 1000;
    uint256 public TRUST_INCREASE_PER_REPAYMENT = 50;     // DAO adjustable
    uint256 public TRUST_DECREASE_ON_DEFAULT = 200;       // DAO adjustable
    
    // Wallet maturity constants
    uint256 public constant MATURITY_LEVEL_1 = 7 days;    // Very low limit
    uint256 public constant MATURITY_LEVEL_2 = 30 days;   // Normal limit
    uint256 public constant MATURITY_LEVEL_3 = 90 days;   // Trust boost
    
    // Interest rate parameters (basis points, 100 = 1%) - DAO adjustable
    uint256 public BASE_INTEREST_RATE = 500;      // 5%
    uint256 public MAX_INTEREST_RATE = 2000;      // 20%
    
    // Loan parameters - DAO adjustable
    uint256 public MIN_LOAN_AMOUNT = 0.01 ether;  // Minimum loan
    uint256 public MIN_LOAN_DURATION = 1 days;    // Minimum duration (for hackathon flexibility)
    uint256 public MAX_LOAN_DURATION = 180 days;  // Maximum duration
    uint256 public DEFAULT_COOLDOWN_PERIOD = 30 days;
    
    // Borrowing limits per trust level - DAO adjustable
    uint256 public LOW_TRUST_LIMIT = 0.1 ether;   // Trust < 300
    uint256 public MED_TRUST_LIMIT = 0.5 ether;   // Trust 300-600
    uint256 public HIGH_TRUST_LIMIT = 2 ether;    // Trust > 600
    
    // Pool tracking
    uint256 public totalPoolLiquidity;
    uint256 public totalActiveLoans;
    uint256 public totalDefaultedAmount;
    
    // DAO governance
    address public daoAddress;
    bool public daoEnabled;
    
    // ============ Structs ============
    
    struct UserProfile {
        uint256 trustScore;
        uint256 totalLoansTaken;
        uint256 successfulRepayments;
        uint256 defaults;
        bool hasActiveLoan;
        uint256 lastDefaultTime;
        uint256 walletFirstSeen;
        uint256 totalTransactions;
    }
    
    struct Loan {
        address borrower;
        uint256 principal;
        uint256 interestAmount;
        uint256 totalRepayment;
        uint256 startTime;
        uint256 dueDate;
        uint256 duration;  // Store the selected duration
        LoanStatus status;
    }
    
    enum LoanStatus {
        ACTIVE,
        REPAID,
        DEFAULTED
    }
    
    struct LenderInfo {
        uint256 depositedAmount;
        uint256 depositTime;
        uint256 totalInterestEarned;
        uint256 lastClaimTime;
    }
    
    struct WalletMaturity {
        uint256 age;
        uint256 maturityLevel;
        uint256 maturityMultiplier;  // Percentage multiplier (100 = 100%)
    }
    
    // ============ Mappings ============
    
    mapping(address => UserProfile) public userProfiles;
    mapping(address => Loan) public activeLoans;
    mapping(address => LenderInfo) public lenders;
    mapping(address => mapping(address => bool)) public vouches;
    
    // Track total interest pool for distribution
    uint256 public totalInterestPool;
    uint256 public totalLenderDeposits;
    
    // ============ Events ============
    
    event LoanRequested(address indexed borrower, uint256 amount, uint256 duration);
    event LoanIssued(address indexed borrower, uint256 principal, uint256 interest, uint256 dueDate, uint256 duration);
    event LoanRepaid(address indexed borrower, uint256 principal, uint256 interest);
    event LoanDefaulted(address indexed borrower, uint256 lostAmount);
    event TrustUpdated(address indexed user, uint256 oldScore, uint256 newScore, string reason);
    event WalletMaturityEvaluated(address indexed user, uint256 maturityLevel, uint256 walletAge);
    
    event LenderDeposited(address indexed lender, uint256 amount);
    event LenderWithdrew(address indexed lender, uint256 amount);
    event InterestClaimed(address indexed lender, uint256 amount);
    event InterestDistributed(uint256 totalAmount);
    
    event VouchCreated(address indexed voucher, address indexed vouchee);
    event DAOEnabled(address indexed daoAddress);
    event ParameterUpdated(string parameter, uint256 oldValue, uint256 newValue);
    
    // ============ Modifiers ============
    
    modifier trackWalletActivity() {
        UserProfile storage user = userProfiles[msg.sender];
        if (user.walletFirstSeen == 0) {
            user.walletFirstSeen = block.timestamp;
        }
        user.totalTransactions++;
        _;
    }
    
    modifier onlyDAO() {
        require(daoEnabled && msg.sender == daoAddress, "Only DAO can call");
        _;
    }
    
    modifier onlyAdminOrDAO() {
        require(msg.sender == owner() || (daoEnabled && msg.sender == daoAddress), "Not authorized");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _lendingToken) Ownable(msg.sender) {
        lendingToken = IERC20(_lendingToken);
        daoEnabled = false;
    }
    
    // ============ DAO Governance Functions ============
    
    /**
     * @dev Enable DAO governance (one-way transition from admin to DAO)
     */
    function enableDAO(address _daoAddress) external onlyOwner {
        require(!daoEnabled, "DAO already enabled");
        require(_daoAddress != address(0), "Invalid DAO address");
        daoAddress = _daoAddress;
        daoEnabled = true;
        emit DAOEnabled(_daoAddress);
    }
    
    /**
     * @dev Update trust adjustment parameters (DAO governance)
     */
    function updateTrustParameters(
        uint256 _increasePerRepayment,
        uint256 _decreaseOnDefault
    ) external onlyAdminOrDAO {
        require(_increasePerRepayment > 0 && _increasePerRepayment <= 100, "Invalid increase");
        require(_decreaseOnDefault > 0 && _decreaseOnDefault <= 500, "Invalid decrease");
        
        emit ParameterUpdated("TRUST_INCREASE", TRUST_INCREASE_PER_REPAYMENT, _increasePerRepayment);
        emit ParameterUpdated("TRUST_DECREASE", TRUST_DECREASE_ON_DEFAULT, _decreaseOnDefault);
        
        TRUST_INCREASE_PER_REPAYMENT = _increasePerRepayment;
        TRUST_DECREASE_ON_DEFAULT = _decreaseOnDefault;
    }
    
    /**
     * @dev Update interest rate parameters (DAO governance)
     */
    function updateInterestRates(uint256 _baseRate, uint256 _maxRate) external onlyAdminOrDAO {
        require(_baseRate < _maxRate, "Base must be less than max");
        require(_maxRate <= 5000, "Max rate too high"); // 50% cap
        
        emit ParameterUpdated("BASE_INTEREST_RATE", BASE_INTEREST_RATE, _baseRate);
        emit ParameterUpdated("MAX_INTEREST_RATE", MAX_INTEREST_RATE, _maxRate);
        
        BASE_INTEREST_RATE = _baseRate;
        MAX_INTEREST_RATE = _maxRate;
    }
    
    /**
     * @dev Update borrowing limits per trust tier (DAO governance)
     */
    function updateBorrowingLimits(
        uint256 _lowTrust,
        uint256 _medTrust,
        uint256 _highTrust
    ) external onlyAdminOrDAO {
        require(_lowTrust < _medTrust && _medTrust < _highTrust, "Invalid limit progression");
        
        emit ParameterUpdated("LOW_TRUST_LIMIT", LOW_TRUST_LIMIT, _lowTrust);
        emit ParameterUpdated("MED_TRUST_LIMIT", MED_TRUST_LIMIT, _medTrust);
        emit ParameterUpdated("HIGH_TRUST_LIMIT", HIGH_TRUST_LIMIT, _highTrust);
        
        LOW_TRUST_LIMIT = _lowTrust;
        MED_TRUST_LIMIT = _medTrust;
        HIGH_TRUST_LIMIT = _highTrust;
    }
    
    /**
     * @dev Update loan duration limits (DAO governance)
     */
    function updateLoanDurationLimits(uint256 _minDuration, uint256 _maxDuration) external onlyAdminOrDAO {
        require(_minDuration >= 1 days, "Min duration too short");
        require(_maxDuration <= 365 days, "Max duration too long");
        require(_minDuration < _maxDuration, "Min must be less than max");
        
        emit ParameterUpdated("MIN_LOAN_DURATION", MIN_LOAN_DURATION, _minDuration);
        emit ParameterUpdated("MAX_LOAN_DURATION", MAX_LOAN_DURATION, _maxDuration);
        
        MIN_LOAN_DURATION = _minDuration;
        MAX_LOAN_DURATION = _maxDuration;
    }
    
    /**
     * @dev Update default cooldown period (DAO governance)
     */
    function updateDefaultCooldown(uint256 _newPeriod) external onlyAdminOrDAO {
        require(_newPeriod >= 7 days && _newPeriod <= 180 days, "Invalid cooldown");
        emit ParameterUpdated("DEFAULT_COOLDOWN", DEFAULT_COOLDOWN_PERIOD, _newPeriod);
        DEFAULT_COOLDOWN_PERIOD = _newPeriod;
    }
    
    // ============ Wallet Maturity Functions ============
    
    /**
     * @dev Get wallet maturity information
     */
    function getWalletMaturity(address wallet) public view returns (WalletMaturity memory) {
        UserProfile memory user = userProfiles[wallet];
        WalletMaturity memory maturity;
        
        if (user.walletFirstSeen == 0) {
            maturity.age = 0;
            maturity.maturityLevel = 0;
            maturity.maturityMultiplier = 20; // 20% for very new wallets
            return maturity;
        }
        
        maturity.age = block.timestamp - user.walletFirstSeen;
        
        if (maturity.age >= MATURITY_LEVEL_3) {
            maturity.maturityLevel = 3;
            maturity.maturityMultiplier = 150; // 150% for mature wallets
        } else if (maturity.age >= MATURITY_LEVEL_2) {
            maturity.maturityLevel = 2;
            maturity.maturityMultiplier = 100; // 100% for established wallets
        } else if (maturity.age >= MATURITY_LEVEL_1) {
            maturity.maturityLevel = 1;
            maturity.maturityMultiplier = 50;  // 50% for young wallets
        } else {
            maturity.maturityLevel = 0;
            maturity.maturityMultiplier = 20;  // 20% for very new wallets
        }
        
        return maturity;
    }
    
    // ============ Lender Functions ============
    
    /**
     * @dev Deposit tokens into lending pool
     */
    function depositToPool(uint256 amount) external nonReentrant whenNotPaused trackWalletActivity {
        require(amount > 0, "Amount must be > 0");
        require(lendingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        LenderInfo storage lender = lenders[msg.sender];
        lender.depositedAmount += amount;
        lender.depositTime = block.timestamp;
        lender.lastClaimTime = block.timestamp;
        
        totalPoolLiquidity += amount;
        totalLenderDeposits += amount;
        
        emit LenderDeposited(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw tokens from pool (can only withdraw principal, not during active loans)
     */
    function withdrawFromPool(uint256 amount) external nonReentrant whenNotPaused trackWalletActivity {
        LenderInfo storage lender = lenders[msg.sender];
        require(amount > 0, "Amount must be > 0");
        require(lender.depositedAmount >= amount, "Insufficient balance");
        
        // Check available liquidity (total - active loans)
        uint256 availableLiquidity = totalPoolLiquidity - totalActiveLoans;
        require(availableLiquidity >= amount, "Insufficient pool liquidity");
        
        lender.depositedAmount -= amount;
        totalPoolLiquidity -= amount;
        totalLenderDeposits -= amount;
        
        require(lendingToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit LenderWithdrew(msg.sender, amount);
    }
    
    /**
     * @dev Claim accrued interest (lenders get proportional share of interest pool)
     */
    function claimInterest() external nonReentrant whenNotPaused trackWalletActivity {
        LenderInfo storage lender = lenders[msg.sender];
        require(lender.depositedAmount > 0, "No deposits");
        
        // Calculate lender's share of total interest pool
        uint256 interestShare = _calculateInterestShare(msg.sender);
        require(interestShare > 0, "No interest to claim");
        
        // Update lender's claimed interest
        lender.totalInterestEarned += interestShare;
        lender.lastClaimTime = block.timestamp;
        
        // Reduce from interest pool and transfer
        totalInterestPool -= interestShare;
        
        require(lendingToken.transfer(msg.sender, interestShare), "Transfer failed");
        
        emit InterestClaimed(msg.sender, interestShare);
    }
    
    /**
     * @dev Calculate lender's proportional share of interest pool
     */
    function _calculateInterestShare(address lenderAddress) internal view returns (uint256) {
        LenderInfo memory lender = lenders[lenderAddress];
        
        if (totalLenderDeposits == 0 || totalInterestPool == 0) {
            return 0;
        }
        
        // Proportional share: (lender deposit / total deposits) * total interest
        return (lender.depositedAmount * totalInterestPool) / totalLenderDeposits;
    }
    
    // ============ Borrower Functions ============
    
    /**
     * @dev Request a loan with custom duration
     * @param amount The loan amount to request
     * @param duration The repayment duration in seconds (must be between MIN and MAX)
     */
    function requestLoan(uint256 amount, uint256 duration) external nonReentrant whenNotPaused trackWalletActivity {
        UserProfile storage user = userProfiles[msg.sender];
        
        // Initialize new user
        if (user.trustScore == 0) {
            user.trustScore = INITIAL_TRUST_SCORE;
        }
        
        // Validation
        require(!user.hasActiveLoan, "Already has active loan");
        require(amount >= MIN_LOAN_AMOUNT, "Amount below minimum");
        require(duration >= MIN_LOAN_DURATION, "Duration too short");
        require(duration <= MAX_LOAN_DURATION, "Duration too long");
        
        // Check default cooldown
        if (user.defaults > 0) {
            require(
                block.timestamp > user.lastDefaultTime + DEFAULT_COOLDOWN_PERIOD,
                "Blocked due to recent default"
            );
        }
        
        // Check wallet maturity and calculate limit
        WalletMaturity memory maturity = getWalletMaturity(msg.sender);
        emit WalletMaturityEvaluated(msg.sender, maturity.maturityLevel, maturity.age);
        
        uint256 maxLoan = _calculateBorrowingLimit(user.trustScore, maturity.maturityMultiplier);
        require(amount <= maxLoan, "Amount exceeds trust/maturity limit");
        
        // Check pool has liquidity
        uint256 availableLiquidity = totalPoolLiquidity - totalActiveLoans;
        require(availableLiquidity >= amount, "Insufficient pool liquidity");
        
        emit LoanRequested(msg.sender, amount, duration);
        
        // Issue loan with user-selected duration
        _issueLoan(msg.sender, amount, duration, maturity.maturityLevel);
    }
    
    /**
     * @dev Internal: Issue loan to borrower with specified duration
     */
    function _issueLoan(address borrower, uint256 amount, uint256 duration, uint256 maturityLevel) internal {
        UserProfile storage user = userProfiles[borrower];
        
        // Calculate interest based on trust and maturity
        uint256 interestRate = _calculateInterestRate(user.trustScore, maturityLevel);
        
        // Calculate interest amount for the user-selected duration
        uint256 interestAmount = (amount * interestRate * duration) / (10000 * 365 days);
        uint256 totalRepayment = amount + interestAmount;
        
        // Create loan
        Loan storage loan = activeLoans[borrower];
        loan.borrower = borrower;
        loan.principal = amount;
        loan.interestAmount = interestAmount;
        loan.totalRepayment = totalRepayment;
        loan.startTime = block.timestamp;
        loan.dueDate = block.timestamp + duration; // User-selected duration
        loan.duration = duration; // Store the duration
        loan.status = LoanStatus.ACTIVE;
        
        // Update state
        user.hasActiveLoan = true;
        user.totalLoansTaken++;
        totalActiveLoans += amount;
        
        // Transfer tokens FROM POOL to borrower
        require(lendingToken.transfer(borrower, amount), "Transfer failed");
        
        emit LoanIssued(borrower, amount, interestAmount, loan.dueDate, duration);
    }
    
    /**
     * @dev Repay loan (principal + interest)
     */
    function repayLoan() external nonReentrant whenNotPaused trackWalletActivity {
        Loan storage loan = activeLoans[msg.sender];
        UserProfile storage user = userProfiles[msg.sender];
        
        require(user.hasActiveLoan, "No active loan");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        
        uint256 principal = loan.principal;
        uint256 interest = loan.interestAmount;
        uint256 totalRepayment = loan.totalRepayment;
        
        // Transfer repayment from borrower to contract
        require(lendingToken.transferFrom(msg.sender, address(this), totalRepayment), "Transfer failed");
        
        // Update loan
        loan.status = LoanStatus.REPAID;
        user.hasActiveLoan = false;
        user.successfulRepayments++;
        
        // Return principal to pool, add interest to interest pool
        totalActiveLoans -= principal;
        totalInterestPool += interest; // Interest goes to pool for lender claims
        
        emit InterestDistributed(interest);
        
        // Increase trust
        uint256 oldTrust = user.trustScore;
        _increaseTrustScore(msg.sender);
        emit TrustUpdated(msg.sender, oldTrust, user.trustScore, "Successful repayment");
        
        emit LoanRepaid(msg.sender, principal, interest);
    }
    
    /**
     * @dev Mark overdue loan as defaulted (anyone can call)
     * Pool absorbs the loss by reducing total liquidity
     */
    function markDefault(address borrower) external nonReentrant {
        Loan storage loan = activeLoans[borrower];
        UserProfile storage user = userProfiles[borrower];
        
        require(user.hasActiveLoan, "No active loan");
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(block.timestamp > loan.dueDate, "Not overdue yet");
        
        uint256 lostAmount = loan.principal;
        
        // Update loan and user
        loan.status = LoanStatus.DEFAULTED;
        user.hasActiveLoan = false;
        user.defaults++;
        user.lastDefaultTime = block.timestamp;
        
        // Pool absorbs loss - reduce total liquidity by the defaulted principal
        // This means lenders collectively lost this amount
        totalActiveLoans -= lostAmount;
        totalPoolLiquidity -= lostAmount;  // LOSS ABSORPTION - pool takes the hit
        totalDefaultedAmount += lostAmount;
        
        // Decrease trust heavily
        uint256 oldTrust = user.trustScore;
        _decreaseTrustScore(borrower);
        emit TrustUpdated(borrower, oldTrust, user.trustScore, "Loan defaulted");
        
        emit LoanDefaulted(borrower, lostAmount);
    }
    
    // ============ Trust Functions ============
    
    /**
     * @dev Vouch for another user
     */
    function vouchForUser(address vouchee) external trackWalletActivity {
        UserProfile storage voucher = userProfiles[msg.sender];
        UserProfile storage voucheeProfile = userProfiles[vouchee];
        
        require(voucher.trustScore >= 500, "Insufficient trust");
        require(voucher.successfulRepayments >= 2, "Need 2+ repayments");
        require(!vouches[msg.sender][vouchee], "Already vouched");
        require(vouchee != msg.sender, "Cannot vouch yourself");
        
        vouches[msg.sender][vouchee] = true;
        
        if (voucheeProfile.trustScore == 0) {
            voucheeProfile.trustScore = INITIAL_TRUST_SCORE + 50;
        } else if (voucheeProfile.trustScore < 300) {
            voucheeProfile.trustScore += 30;
        }
        
        emit VouchCreated(msg.sender, vouchee);
    }
    
    function _increaseTrustScore(address user) internal {
        UserProfile storage profile = userProfiles[user];
        
        uint256 increase = TRUST_INCREASE_PER_REPAYMENT;
        
        // Bonus for consistency
        if (profile.successfulRepayments >= 5) {
            increase += 20;
        }
        if (profile.successfulRepayments >= 10) {
            increase += 10;
        }
        
        if (profile.trustScore + increase > MAX_TRUST_SCORE) {
            profile.trustScore = MAX_TRUST_SCORE;
        } else {
            profile.trustScore += increase;
        }
    }
    
    function _decreaseTrustScore(address user) internal {
        UserProfile storage profile = userProfiles[user];
        
        uint256 decrease = TRUST_DECREASE_ON_DEFAULT;
        
        if (profile.defaults > 1) {
            decrease += 100;
        }
        
        if (profile.trustScore > decrease) {
            profile.trustScore -= decrease;
        } else {
            profile.trustScore = INITIAL_TRUST_SCORE / 2;
        }
    }
    
    // ============ Calculation Functions ============
    
    /**
     * @dev Calculate borrowing limit based on trust tier and maturity
     */
    function _calculateBorrowingLimit(uint256 trustScore, uint256 maturityMultiplier) 
        internal 
        view 
        returns (uint256) 
    {
        uint256 baseLimit;
        
        if (trustScore < 300) {
            baseLimit = LOW_TRUST_LIMIT;
        } else if (trustScore < 600) {
            baseLimit = MED_TRUST_LIMIT;
        } else {
            baseLimit = HIGH_TRUST_LIMIT;
        }
        
        // Apply maturity multiplier (20%, 50%, 100%, or 150%)
        return (baseLimit * maturityMultiplier) / 100;
    }
    
    /**
     * @dev Calculate interest rate
     */
    function _calculateInterestRate(uint256 trustScore, uint256 maturityLevel) 
        internal 
        view 
        returns (uint256) 
    {
        uint256 rate = BASE_INTEREST_RATE;
        
        // Trust penalty
        if (trustScore < 300) {
            rate += 700; // +7%
        } else if (trustScore < 600) {
            rate += 300; // +3%
        }
        
        // Maturity penalty
        if (maturityLevel == 0) {
            rate += 500; // +5%
        } else if (maturityLevel == 1) {
            rate += 200; // +2%
        }
        
        // Pool utilization
        if (totalPoolLiquidity > 0) {
            uint256 utilization = (totalActiveLoans * 100) / totalPoolLiquidity;
            rate += utilization * 2;
        }
        
        if (rate > MAX_INTEREST_RATE) {
            rate = MAX_INTEREST_RATE;
        }
        
        return rate;
    }
    
    // ============ View Functions ============
    
    function getUserProfile(address user) external view returns (
        uint256 trustScore,
        uint256 totalLoansTaken,
        uint256 successfulRepayments,
        uint256 defaults,
        bool hasActiveLoan,
        uint256 walletAge,
        uint256 maturityLevel,
        uint256 maxBorrowingLimit
    ) {
        UserProfile memory profile = userProfiles[user];
        WalletMaturity memory maturity = getWalletMaturity(user);
        uint256 trust = profile.trustScore == 0 ? INITIAL_TRUST_SCORE : profile.trustScore;
        
        return (
            trust,
            profile.totalLoansTaken,
            profile.successfulRepayments,
            profile.defaults,
            profile.hasActiveLoan,
            maturity.age,
            maturity.maturityLevel,
            _calculateBorrowingLimit(trust, maturity.maturityMultiplier)
        );
    }
    
    function getActiveLoan(address borrower) external view returns (
        uint256 principal,
        uint256 interestAmount,
        uint256 totalRepayment,
        uint256 dueDate,
        uint256 duration,
        LoanStatus status,
        bool isOverdue
    ) {
        Loan memory loan = activeLoans[borrower];
        return (
            loan.principal,
            loan.interestAmount,
            loan.totalRepayment,
            loan.dueDate,
            loan.duration,
            loan.status,
            block.timestamp > loan.dueDate && loan.status == LoanStatus.ACTIVE
        );
    }
    
    function getLenderInfo(address lender) external view returns (
        uint256 depositedAmount,
        uint256 totalInterestEarned,
        uint256 pendingInterest
    ) {
        LenderInfo memory info = lenders[lender];
        return (
            info.depositedAmount,
            info.totalInterestEarned,
            _calculateInterestShare(lender)
        );
    }
    
    function getPoolStats() external view returns (
        uint256 totalLiquidity,
        uint256 totalActiveLoanAmount,
        uint256 availableLiquidity,
        uint256 utilizationRate,
        uint256 interestPool,
        uint256 totalDefaulted
    ) {
        uint256 available = totalPoolLiquidity > totalActiveLoans ? 
            totalPoolLiquidity - totalActiveLoans : 0;
        uint256 utilization = totalPoolLiquidity > 0 ? 
            (totalActiveLoans * 10000) / totalPoolLiquidity : 0;
        
        return (
            totalPoolLiquidity,
            totalActiveLoans,
            available,
            utilization,
            totalInterestPool,
            totalDefaultedAmount
        );
    }
    
    function getDAOInfo() external view returns (
        bool enabled,
        address dao,
        uint256 trustIncrease,
        uint256 trustDecrease,
        uint256 baseRate,
        uint256 maxRate,
        uint256 minDuration,
        uint256 maxDuration
    ) {
        return (
            daoEnabled,
            daoAddress,
            TRUST_INCREASE_PER_REPAYMENT,
            TRUST_DECREASE_ON_DEFAULT,
            BASE_INTEREST_RATE,
            MAX_INTEREST_RATE,
            MIN_LOAN_DURATION,
            MAX_LOAN_DURATION
        );
    }
    
    function getLoanDurationLimits() external view returns (uint256 minDuration, uint256 maxDuration) {
        return (MIN_LOAN_DURATION, MAX_LOAN_DURATION);
    }
    
    // ============ Admin Functions ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
}
