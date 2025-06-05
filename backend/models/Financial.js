const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    required: true,
    enum: ['Credit - Deposit', 'Debit - Expense'],
  },
  source: {
    type: String,
    required: true,
    enum: ['IDFC BC-1', 'IDFC BC-2', 'IDFC MI-1', 'IDFC MI-2', 'CENTRAL BANK', 'ICICI', 'CASH IN HAND'],
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  expenseCategory: {
    type: String,
    default: 'N/A',
  },
  remarks: {
    type: String,
    default: 'N/A',
  },
});

const financialSchema = new mongoose.Schema({
  idfcBc1Balance: {
    type: Number,
    default: 0,
  },
  idfcBc2Balance: {
    type: Number,
    default: 0,
  },
  idfcMi1Balance: {
    type: Number,
    default: 0,
  },
  idfcMi2Balance: {
    type: Number,
    default: 0,
  },
  centralBankBalance: {
    type: Number,
    default: 0,
  },
  iciciBalance: {
    type: Number,
    default: 0,
  },
  cashBalance: {
    type: Number,
    default: 0,
  },
  transactions: [transactionSchema],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Financial', financialSchema);