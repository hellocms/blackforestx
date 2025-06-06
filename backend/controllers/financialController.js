const mongoose = require('mongoose');
const Financial = require('../models/Financial');

// Initialize the financial document, ensuring only one exists
const initializeFinancial = async () => {
  const result = await Financial.findOneAndUpdate(
    {}, // Match any document (first one)
    {
      $setOnInsert: {
        idfcBc1Balance: 0,
        idfcBc2Balance: 0,
        idfcMi1Balance: 0,
        idfcMi2Balance: 0,
        centralBankBalance: 0,
        iciciBalance: 0,
        branchBalances: [],
        totalCashBalance: 0,
        transactions: [],
        lastUpdated: Date.now(),
      },
    },
    { upsert: true, new: true }
  );
  console.log('Financial document initialized or found:', result._id);
};

// Get all balances
const getBalances = async (req, res) => {
  try {
    await initializeFinancial();
    const financial = await Financial.findOne().populate('branchBalances.branch', 'name');
    if (!financial) {
      return res.status(404).json({ message: 'Financial data not found' });
    }
    const balances = [
      { source: 'IDFC BC-1', balance: financial.idfcBc1Balance },
      { source: 'IDFC BC-2', balance: financial.idfcBc2Balance },
      { source: 'IDFC MI-1', balance: financial.idfcMi1Balance },
      { source: 'IDFC MI-2', balance: financial.idfcMi2Balance },
      { source: 'CENTRAL BANK', balance: financial.centralBankBalance },
      { source: 'ICICI', balance: financial.iciciBalance },
      ...financial.branchBalances.map((bb) => ({
        source: `CASH IN HAND - ${bb.branch.name}`,
        branchId: bb.branch._id,
        balance: bb.cashBalance,
      })),
      { source: 'TOTAL CASH IN HAND', balance: financial.totalCashBalance },
    ];
    res.status(200).json(balances);
  } catch (err) {
    console.error('Error fetching balances:', err);
    res.status(500).json({ message: 'Server error while fetching balances' });
  }
};

// Get all transactions
const getTransactions = async (req, res) => {
  try {
    await initializeFinancial();
    const financial = await Financial.findOne().populate('transactions.branch', 'name');
    if (!financial) {
      return res.status(404).json({ message: 'Financial data not found' });
    }
    res.status(200).json(financial.transactions);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ message: 'Server error while fetching transactions' });
  }
};

// Record a deposit
const recordDeposit = async (req, res) => {
  const { source, amount, branch, remarks } = req.body;

  console.log('Deposit request body:', { source, amount, branch, remarks });

  if (source === undefined || source === null || amount === undefined || amount === null || branch === undefined || branch === null) {
    return res.status(400).json({ message: 'Source, amount, and branch are required' });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  try {
    await initializeFinancial();
    const financial = await Financial.findOne();
    if (!financial) {
      return res.status(404).json({ message: 'Financial data not found' });
    }

    let updatedBalance;
    if (source === 'CASH IN HAND') {
      // Find or create branch balance entry
      const branchId = new mongoose.Types.ObjectId(branch);
      let branchBalanceIndex = financial.branchBalances.findIndex(bb => bb.branch.toString() === branch);
      if (branchBalanceIndex === -1) {
        financial.branchBalances.push({ branch: branchId, cashBalance: 0 });
        branchBalanceIndex = financial.branchBalances.length - 1;
      }
      // Update cash balance for the branch
      financial.branchBalances[branchBalanceIndex].cashBalance += amount;
      financial.markModified('branchBalances'); // Ensure subdocument changes are saved
      // Update total cash balance
      financial.totalCashBalance += amount;
      updatedBalance = financial.branchBalances[branchBalanceIndex].cashBalance;
    } else {
      switch (source) {
        case 'IDFC BC-1':
          financial.idfcBc1Balance += amount;
          updatedBalance = financial.idfcBc1Balance;
          break;
        case 'IDFC BC-2':
          financial.idfcBc2Balance += amount;
          updatedBalance = financial.idfcBc2Balance;
          break;
        case 'IDFC MI-1':
          financial.idfcMi1Balance += amount;
          updatedBalance = financial.idfcMi1Balance;
          break;
        case 'IDFC MI-2':
          financial.idfcMi2Balance += amount;
          updatedBalance = financial.idfcMi2Balance;
          break;
        case 'CENTRAL BANK':
          financial.centralBankBalance += amount;
          updatedBalance = financial.centralBankBalance;
          break;
        case 'ICICI':
          financial.iciciBalance += amount;
          updatedBalance = financial.iciciBalance;
          break;
        default:
          return res.status(400).json({ message: 'Invalid source' });
      }
    }

    // Add transaction
    const transaction = {
      type: 'Credit - Deposit',
      source,
      branch: new mongoose.Types.ObjectId(branch),
      amount,
      expenseCategory: 'N/A',
      remarks: remarks || 'N/A',
    };

    financial.transactions.push(transaction);
    financial.lastUpdated = Date.now();

    // Save the updated document
    await financial.save();

    // Populate the newly added transaction for response
    const populatedFinancial = await Financial.findOne()
      .populate('transactions.branch', 'name')
      .select('transactions');
    const populatedTransaction = populatedFinancial.transactions[populatedFinancial.transactions.length - 1];

    const balanceResponse = { source, balance: updatedBalance, branch };

    res.status(201).json({ balance: balanceResponse, transaction: populatedTransaction });
  } catch (err) {
    console.error('Error recording deposit:', err);
    res.status(500).json({ message: 'Server error while recording deposit' });
  }
};

// Record an expense
const recordExpense = async (req, res) => {
  const { source, amount, branch, remarks, category } = req.body;

  console.log('Expense request body:', { source, amount, branch, remarks, category });

  if (source === undefined || source === null || amount === undefined || amount === null || 
      branch === undefined || branch === null || category === undefined || category === null) {
    return res.status(400).json({ message: 'Source, amount, branch, and category are required' });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  try {
    await initializeFinancial();
    const financial = await Financial.findOne();
    if (!financial) {
      return res.status(404).json({ message: 'Financial data not found' });
    }

    let updatedBalance;
    if (source === 'CASH IN HAND') {
      // Find branch balance entry
      const branchId = new mongoose.Types.ObjectId(branch);
      const branchBalanceIndex = financial.branchBalances.findIndex(bb => bb.branch.toString() === branch);
      if (branchBalanceIndex === -1 || financial.branchBalances[branchBalanceIndex].cashBalance < amount) {
        return res.status(400).json({ message: `Insufficient balance in CASH IN HAND for branch ${branch}` });
      }
      // Update cash balance for the branch
      financial.branchBalances[branchBalanceIndex].cashBalance -= amount;
      financial.markModified('branchBalances'); // Ensure subdocument changes are saved
      // Update total cash balance
      financial.totalCashBalance -= amount;
      updatedBalance = financial.branchBalances[branchBalanceIndex].cashBalance;
    } else {
      switch (source) {
        case 'IDFC BC-1':
          if (amount > financial.idfcBc1Balance) {
            return res.status(400).json({ message: 'Insufficient balance in IDFC BC-1' });
          }
          financial.idfcBc1Balance -= amount;
          updatedBalance = financial.idfcBc1Balance;
          break;
        case 'IDFC BC-2':
          if (amount > financial.idfcBc2Balance) {
            return res.status(400).json({ message: 'Insufficient balance in IDFC BC-2' });
          }
          financial.idfcBc2Balance -= amount;
          updatedBalance = financial.idfcBc2Balance;
          break;
        case 'IDFC MI-1':
          if (amount > financial.idfcMi1Balance) {
            return res.status(400).json({ message: 'Insufficient balance in IDFC MI-1' });
          }
          financial.idfcMi1Balance -= amount;
          updatedBalance = financial.idfcMi1Balance;
          break;
        case 'IDFC MI-2':
          if (amount > financial.idfcMi2Balance) {
            return res.status(400).json({ message: 'Insufficient balance in IDFC MI-2' });
          }
          financial.idfcMi2Balance -= amount;
          updatedBalance = financial.idfcMi2Balance;
          break;
        case 'CENTRAL BANK':
          if (amount > financial.centralBankBalance) {
            return res.status(400).json({ message: 'Insufficient balance in CENTRAL BANK' });
          }
          financial.centralBankBalance -= amount;
          updatedBalance = financial.centralBankBalance;
          break;
        case 'ICICI':
          if (amount > financial.iciciBalance) {
            return res.status(400).json({ message: 'Insufficient balance in ICICI' });
          }
          financial.iciciBalance -= amount;
          updatedBalance = financial.iciciBalance;
          break;
        default:
          return res.status(400).json({ message: 'Invalid source' });
      }
    }

    // Add transaction
    const transaction = {
      type: 'Debit - Expense',
      source,
      branch: new mongoose.Types.ObjectId(branch),
      amount,
      expenseCategory: category,
      remarks: remarks || 'N/A',
    };

    financial.transactions.push(transaction);
    financial.lastUpdated = Date.now();

    // Save the updated document
    await financial.save();

    // Populate the newly added transaction for response
    const populatedFinancial = await Financial.findOne()
      .populate('transactions.branch', 'name')
      .select('transactions');
    const populatedTransaction = populatedFinancial.transactions[populatedFinancial.transactions.length - 1];

    const balanceResponse = { source, balance: updatedBalance, branch };

    res.status(201).json({ balance: balanceResponse, transaction: populatedTransaction });
  } catch (err) {
    console.error('Error recording expense:', err);
    res.status(500).json({ message: 'Server error while recording expense' });
  }
};

module.exports = {
  getBalances,
  getTransactions,
  recordDeposit,
  recordExpense,
};