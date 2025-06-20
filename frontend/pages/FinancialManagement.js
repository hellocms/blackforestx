
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Form, Select, InputNumber, Input, Button, Table, Space, DatePicker, message, Layout } from 'antd';
import { BankOutlined, MoneyCollectOutlined, PrinterOutlined, ClearOutlined, SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import BranchHeader from '../components/BranchHeader';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const FinancialManagement = () => {
  // State for balances
  const [idfcBc1Balance, setIdfcBc1Balance] = useState(0);
  const [idfcBc2Balance, setIdfcBc2Balance] = useState(0);
  const [idfcMi1Balance, setIdfcMi1Balance] = useState(0);
  const [idfcMi2Balance, setIdfcMi2Balance] = useState(0);
  const [centralBankBalance, setCentralBankBalance] = useState(0);
  const [iciciBalance, setIciciBalance] = useState(0);
  const [branchBalances, setBranchBalances] = useState([]);
  const [totalCashBalance, setTotalCashBalance] = useState(0);

  // State for transactions and filters
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(null); // Added for branch filter

  // State for branch handling
  const [userBranchId, setUserBranchId] = useState(null);
  const [userBranchName, setUserBranchName] = useState('Loading...');
  const [isOfficeBranch, setIsOfficeBranch] = useState(false);

  // Form instances
  const [depositForm] = Form.useForm();
  const [expenseForm] = Form.useForm();

  const router = useRouter();
  const BACKEND_URL = 'https://apib.dinasuvadu.in';

  // Fetch branch details
  const fetchBranchDetails = async (token, branchId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/branches`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const branch = data.find(b => b._id === branchId);
        if (branch) {
          setUserBranchName(branch.name || 'Unknown Branch');
          setIsOfficeBranch(branch.name.toLowerCase() === 'office');
        } else {
          message.error('Branch not found');
          setUserBranchName('Unknown Branch');
        }
      } else {
        message.error('Failed to fetch branch details');
        setUserBranchName('Unknown Branch');
      }
    } catch (error) {
      console.error('Error fetching branch details:', error);
      message.error('Error fetching branch details');
      setUserBranchName('Unknown Branch');
    }
  };

  // Fetch initial data
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.info('Please log in to access the page');
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded.branchId) {
        setUserBranchId(decoded.branchId);
        fetchBranchDetails(token, decoded.branchId);
      } else {
        message.error('No branch associated with this user');
        router.push('/login');
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      message.error('Invalid token, please log in again');
      router.push('/login');
    }

    fetchBalances();
    fetchTransactions();
    fetchBranches();
  }, [router]);

  // Set form branch values
  useEffect(() => {
    if (userBranchId && !isOfficeBranch) {
      depositForm.setFieldsValue({ branch: userBranchId });
      expenseForm.setFieldsValue({ branch: userBranchId });
    }
  }, [userBranchId, isOfficeBranch, depositForm, expenseForm]);

  // Filter transactions when userBranchId or other filters change
  useEffect(() => {
    if (userBranchId) {
      filterTransactions(selectedSourceFilter, selectedTypeFilter, selectedDateRange, selectedBranchFilter);
    }
  }, [transactions, userBranchId, selectedSourceFilter, selectedTypeFilter, selectedDateRange, selectedBranchFilter]);

  // Fetch balances
  const fetchBalances = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/balances`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setBranchBalances([]); // Clear existing branch balances
        result.forEach((balance) => {
          switch (balance.source) {
            case 'IDFC BC-1':
              setIdfcBc1Balance(balance.balance);
              break;
            case 'IDFC BC-2':
              setIdfcBc2Balance(balance.balance);
              break;
            case 'IDFC MI-1':
              setIdfcMi1Balance(balance.balance);
              break;
            case 'IDFC MI-2':
              setIdfcMi2Balance(balance.balance);
              break;
            case 'CENTRAL BANK':
              setCentralBankBalance(balance.balance);
              break;
            case 'ICICI':
              setIciciBalance(balance.balance);
              break;
            case 'TOTAL CASH IN HAND':
              setTotalCashBalance(balance.balance);
              break;
            default:
              if (balance.source.startsWith('CASH IN HAND - ')) {
                setBranchBalances((prev) => {
                  const existing = prev.find(bb => bb.branchId === balance.branchId);
                  if (existing) {
                    return prev.map(bb => bb.branchId === balance.branchId ? { ...bb, balance: balance.balance } : bb);
                  }
                  return [...prev, { branchId: balance.branchId, source: balance.source, balance: balance.balance }];
                });
              }
              break;
          }
        });
      } else {
        message.error(result.message || 'Failed to fetch balances');
      }
    } catch (err) {
      message.error('Server error while fetching balances');
      console.error('Error:', err);
    }
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/transactions`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        const formattedTransactions = result.map((t) => ({
          id: t._id,
          date: t.date,
          type: t.type,
          source: t.source,
          branch: t.branch?.name || 'N/A',
          branchId: t.branch?._id,
          amount: t.amount,
          expenseCategory: t.expenseCategory,
          remarks: t.remarks,
        }));
        setTransactions(formattedTransactions);
      } else {
        message.error(result.message || 'Failed to fetch transactions');
      }
    } catch (err) {
      message.error('Server error while fetching transactions');
      console.error('Error:', err);
    }
  };

  // Fetch branches
  const fetchBranches = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/branches/public`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setBranches(result);
      } else {
        message.error('Failed to fetch branches');
      }
    } catch (err) {
      message.error('Server error while fetching branches');
      console.error('Error:', err);
    }
  };

  // Custom validator for amount
  const validateAmount = (_, value) => {
    if (value === undefined || value === null) {
      return Promise.reject(new Error('Please enter an amount'));
    }
    if (typeof value !== 'number') {
      return Promise.reject(new Error('Amount must be a number'));
    }
    if (value < 1) {
      return Promise.reject(new Error('Amount must be at least 1'));
    }
    return Promise.resolve();
  };

  // Custom validator for expense amount against branch balance
  const validateExpenseAmount = async (_, value, branchId) => {
    if (value === undefined || value === null) {
      return Promise.reject(new Error('Please enter an amount'));
    }
    if (typeof value !== 'number') {
      return Promise.reject(new Error('Amount must be a number'));
    }
    if (value < 1) {
      return Promise.reject(new Error('Amount must be at least 1'));
    }
    if (!branchId) {
      return Promise.reject(new Error('Please select a branch'));
    }
    const branchBalance = branchBalances.find(bb => bb.branchId === branchId)?.balance || 0;
    if (value > branchBalance) {
      return Promise.reject(new Error('Insufficient cash balance for this branch'));
    }
    return Promise.resolve();
  };

  // Handle deposit form submission
  const handleDeposit = async (values) => {
    const { source, amount, branch, remarks } = values;

    console.log('Deposit form values:', { source, amount, branch, remarks });

    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, amount, branch, remarks }),
      });
      const result = await response.json();
      if (response.ok) {
        // Update balance
        if (source === 'CASH IN HAND') {
          setBranchBalances((prev) => {
            const existing = prev.find(bb => bb.branchId === result.balance.branch);
            if (existing) {
              return prev.map(bb => bb.branchId === result.balance.branch ? { ...bb, balance: result.balance.balance } : bb);
            }
            const branchName = branches.find(b => b._id === result.balance.branch)?.name || 'Unknown Branch';
            return [...prev, { branchId: result.balance.branch, source: `CASH IN HAND - ${branchName}`, balance: result.balance.balance }];
          });
          setTotalCashBalance(prev => prev + amount);
        } else {
          switch (source) {
            case 'IDFC BC-1':
              setIdfcBc1Balance(result.balance.balance);
              break;
            case 'IDFC BC-2':
              setIdfcBc2Balance(result.balance.balance);
              break;
            case 'IDFC MI-1':
              setIdfcMi1Balance(result.balance.balance);
              break;
            case 'IDFC MI-2':
              setIdfcMi2Balance(result.balance.balance);
              break;
            case 'CENTRAL BANK':
              setCentralBankBalance(result.balance.balance);
              break;
            case 'ICICI':
              setIciciBalance(result.balance.balance);
              break;
            default:
              break;
          }
        }

        // Add transaction to history
        const newTransaction = {
          id: result.transaction._id,
          date: result.transaction.date,
          type: result.transaction.type,
          source: result.transaction.source,
          branch: result.transaction.branch?.name || 'N/A',
          branchId: result.transaction.branch?._id,
          amount: result.transaction.amount,
          expenseCategory: result.transaction.expenseCategory,
          remarks: result.transaction.remarks,
        };
        setTransactions((prev) => [...prev, newTransaction]);
        setFilteredTransactions((prev) => [...prev, newTransaction]);

        message.success('Deposit recorded successfully');
        depositForm.resetFields();
      } else {
        message.error(result.message || 'Failed to record deposit');
      }
    } catch (err) {
      message.error('Server error while recording deposit');
      console.error('Error:', err);
    }
  };

  // Handle expense form submission
  const handleExpense = async (values) => {
    const { source, category, amount, branch, remarks } = values;

    console.log('Expense form values:', { source, category, amount, branch, remarks });

    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, category, amount, branch, remarks }),
      });
      const result = await response.json();
      if (response.ok) {
        // Update balance
        if (source === 'CASH IN HAND') {
          setBranchBalances((prev) => {
            const existing = prev.find(bb => bb.branchId === result.balance.branch);
            if (existing) {
              return prev.map(bb => bb.branchId === result.balance.branch ? { ...bb, balance: result.balance.balance } : bb);
            }
            const branchName = branches.find(b => b._id === result.balance.branch)?.name || 'Unknown Branch';
            return [...prev, { branchId: result.balance.branch, source: `CASH IN HAND - ${branchName}`, balance: result.balance.balance }];
          });
          setTotalCashBalance(prev => prev - amount);
        } else {
          switch (source) {
            case 'IDFC BC-1':
              setIdfcBc1Balance(result.balance.balance);
              break;
            case 'IDFC BC-2':
              setIdfcBc2Balance(result.balance.balance);
              break;
            case 'IDFC MI-1':
              setIdfcMi1Balance(result.balance.balance);
              break;
            case 'IDFC MI-2':
              setIdfcMi2Balance(result.balance.balance);
              break;
            case 'CENTRAL BANK':
              setCentralBankBalance(result.balance.balance);
              break;
            case 'ICICI':
              setIciciBalance(result.balance.balance);
              break;
            default:
              break;
          }
        }

        // Add transaction to history
        const newTransaction = {
          id: result.transaction._id,
          date: result.transaction.date,
          type: result.transaction.type,
          source: result.transaction.source,
          branch: result.transaction.branch?.name || 'N/A',
          branchId: result.transaction.branch?._id,
          amount: result.transaction.amount,
          expenseCategory: result.transaction.expenseCategory,
          remarks: result.transaction.remarks,
        };
        setTransactions((prev) => [...prev, newTransaction]);
        setFilteredTransactions((prev) => [...prev, newTransaction]);

        message.success('Expense recorded successfully');
        expenseForm.resetFields();
      } else {
        message.error(result.message || 'Failed to record expense');
      }
    } catch (err) {
      message.error('Server error while recording expense');
      console.error('Error:', err);
    }
  };

  // Filter transactions
  const filterTransactions = (source, type, dateRange, branchFilter) => {
    let filtered = [...transactions];

    // Apply branch filter: non-Office users see only their branch, Office users filter by selected branch or see all
    if (!isOfficeBranch) {
      filtered = filtered.filter((t) => t.branchId === userBranchId);
    } else if (branchFilter) {
      filtered = filtered.filter((t) => t.branchId === branchFilter);
    }

    if (source) {
      filtered = filtered.filter((t) => t.source === source || t.source.startsWith('CASH IN HAND - '));
    }

    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    if (dateRange && dateRange.length === 2) {
      const startDate = dayjs(dateRange[0]).startOf('day');
      const endDate = dayjs(dateRange[1]).endOf('day');
      filtered = filtered.filter((t) => {
        const transactionDate = dayjs(t.date);
        return transactionDate.isValid() && transactionDate.isBetween(startDate, endDate, null, '[]');
      });
    }

    setFilteredTransactions(filtered);
  };

  const handleSourceFilter = (value) => {
    setSelectedSourceFilter(value);
    filterTransactions(value, selectedTypeFilter, selectedDateRange, selectedBranchFilter);
  };

  const handleTypeFilter = (value) => {
    setSelectedTypeFilter(value);
    filterTransactions(selectedSourceFilter, value, selectedDateRange, selectedBranchFilter);
  };

  const handleDateFilter = (dates) => {
    setSelectedDateRange(dates);
    filterTransactions(selectedSourceFilter, selectedTypeFilter, dates, selectedBranchFilter);
  };

  const handleBranchFilter = (value) => {
    setSelectedBranchFilter(value);
    filterTransactions(selectedSourceFilter, selectedTypeFilter, selectedDateRange, value);
  };

  const clearFilters = () => {
    setSelectedSourceFilter(null);
    setSelectedTypeFilter(null);
    setSelectedDateRange(null);
    setSelectedBranchFilter(null);
    filterTransactions(null, null, null, null);
  };

  // Print transaction history
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Transaction History</title>
          <style>
            @media print {
              @page { size: A4; margin: 20mm; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #000; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Transaction History</h1>
          <table>
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Date</th>
                <th>Type</th>
                <th>Source</th>
                <th>Branch</th>
                <th>Amount (₹)</th>
                <th>Expense Category</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions
                .map(
                  (t, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${dayjs(t.date).local().format('YYYY-MM-DD HH:mm:ss')}</td>
                      <td>${t.type}</td>
                      <td>${t.source}</td>
                      <td>${t.branch}</td>
                      <td>₹${t.amount.toFixed(2)}</td>
                      <td>${t.expenseCategory}</td>
                      <td>${t.remarks}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Transaction table columns
  const columns = [
    {
      title: 'Serial No',
      key: 'serial_no',
      render: (_, __, index) => index + 1,
      width: 80,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date) => dayjs(date).local().format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
    },
    {
      title: 'Branch',
      dataIndex: 'branch',
      key: 'branch',
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `₹${amount.toFixed(2)}`,
    },
    {
      title: 'Expense Category',
      dataIndex: 'expenseCategory',
      key: 'expenseCategory',
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <BranchHeader />
      <div
        style={{
          padding: '40px 20px',
          background: 'linear-gradient(to bottom, #f0f2f5, #e6e9f0)',
          minHeight: 'calc(100vh - 64px)',
          marginTop: '64px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ maxWidth: '1200px', width: '100%' }}>
          {/* Page Title */}
          <Title
            level={2}
            style={{
              marginBottom: '40px',
              color: '#1a3042',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            Financial Management
          </Title>

          {/* Section 1: Current Balances Overview (Office Branch Only) */}
          {isOfficeBranch && (
            <>
              <Title level={4} style={{ marginBottom: '20px', color: '#1a3042' }}>
                Current Balances
              </Title>
              <Row gutter={[24, 24]} style={{ marginBottom: '40px' }}>
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <BankOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      IDFC BC-1: ₹{idfcBc1Balance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <BankOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      IDFC BC-2: ₹{idfcBc2Balance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <BankOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      IDFC MI-1: ₹{idfcMi1Balance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <BankOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      IDFC MI-2: ₹{idfcMi2Balance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <BankOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      CENTRAL BANK: ₹{centralBankBalance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <BankOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      ICICI: ₹{iciciBalance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
                {branchBalances.map((bb) => (
                  <Col xs={24} sm={12} md={6} key={bb.branchId}>
                    <Card
                      style={{
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        textAlign: 'center',
                        height: '150px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <MoneyCollectOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                      <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                        {bb.source}: ₹{bb.balance.toFixed(2)}
                      </Text>
                    </Card>
                  </Col>
                ))}
                <Col xs={24} sm={12} md={6}>
                  <Card
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      height: '150px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <MoneyCollectOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                    <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                      TOTAL CASH IN HAND: ₹{totalCashBalance.toFixed(2)}
                    </Text>
                  </Card>
                </Col>
              </Row>
            </>
          )}

          {/* Section 2: Deposit Form */}
          <Title level={4} style={{ marginBottom: '20px', color: '#1a3042' }}>
            Deposit Funds
          </Title>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginBottom: '40px',
            }}
          >
            <Form
              form={depositForm}
              layout="vertical"
              onFinish={handleDeposit}
              style={{ maxWidth: '600px', margin: '0 auto' }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Source"
                    name="source"
                    rules={[{ required: true, message: 'Please select a source' }]}
                  >
                    <Select placeholder="Select Source">
                      <Option value="IDFC BC-1">IDFC BC-1</Option>
                      <Option value="IDFC BC-2">IDFC BC-2</Option>
                      <Option value="IDFC MI-1">IDFC MI-1</Option>
                      <Option value="IDFC MI-2">IDFC MI-2</Option>
                      <Option value="CENTRAL BANK">CENTRAL BANK</Option>
                      <Option value="ICICI">ICICI</Option>
                      <Option value="CASH IN HAND">CASH IN HAND</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Amount (₹)"
                    name="amount"
                    rules={[{ validator: validateAmount }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Branch"
                    name="branch"
                    rules={[{ required: true, message: 'Please select a branch' }]}
                  >
                    {isOfficeBranch ? (
                      <Select placeholder="Select Branch">
                        {branches.map((branch) => (
                          <Option key={branch._id} value={branch._id}>
                            {branch.name}
                          </Option>
                        ))}
                      </Select>
                    ) : (
                      <>
                        <Input
                          value={userBranchName}
                          readOnly
                          style={{ width: '100%', color: '#000000', background: '#f5f5f5', borderColor: '#d3d3d3' }}
                        />
                        <Form.Item name="branch" hidden>
                          <Input hidden value={userBranchId} />
                        </Form.Item>
                      </>
                    )}
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Remarks" name="remarks">
                    <Input placeholder="Optional remarks" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
                  Deposit
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* Section 3: Expense Form */}
          <Title level={4} style={{ marginBottom: '20px', color: '#1a3042' }}>
            Record Expense
          </Title>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginBottom: '40px',
            }}
          >
            <Form
              form={expenseForm}
              layout="vertical"
              onFinish={handleExpense}
              style={{ maxWidth: '600px', margin: '0 auto' }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Payment Source"
                    name="source"
                    rules={[{ required: true, message: 'Please select a payment source' }]}
                  >
                    <Select placeholder="Select Source">
                      <Option value="IDFC BC-1">IDFC BC-1</Option>
                      <Option value="IDFC BC-2">IDFC BC-2</Option>
                      <Option value="IDFC MI-1">IDFC MI-1</Option>
                      <Option value="IDFC MI-2">IDFC MI-2</Option>
                      <Option value="CENTRAL BANK">CENTRAL BANK</Option>
                      <Option value="ICICI">ICICI</Option>
                      <Option value="CASH IN HAND">CASH IN HAND</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Expense Category"
                    name="category"
                    rules={[{ required: true, message: 'Please select an expense category' }]}
                  >
                    <Select placeholder="Select Category">
                      <Option value="Rent">Rent</Option>
                      <Option value="EB">EB</Option>
                      <Option value="Salary">Salary</Option>
                      <Option value="Petrol">Petrol</Option>
                      <Option value="Vehicle Expense">Vehicle Expense</Option>
                      <Option value="Buying Materials">Buying Materials</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) => prevValues.branch !== currentValues.branch}
                  >
                    {({ getFieldValue }) => {
                      const branchId = getFieldValue('branch');
                      return (
                        <Form.Item
                          label="Amount (₹)"
                          name="amount"
                          rules={[{ validator: (_, value) => validateExpenseAmount(_, value, branchId) }]}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Branch"
                    name="branch"
                    rules={[{ required: true, message: 'Please select a branch' }]}
                  >
                    {isOfficeBranch ? (
                      <Select placeholder="Select Branch">
                        {branches.map((branch) => (
                          <Option key={branch._id} value={branch._id}>
                            {branch.name}
                          </Option>
                        ))}
                      </Select>
                    ) : (
                      <>
                        <Input
                          value={userBranchName}
                          readOnly
                          style={{ width: '100%', color: '#000000', background: '#f5f5f5', borderColor: '#d3d3d3' }}
                        />
                        <Form.Item name="branch" hidden>
                          <Input hidden value={userBranchId} />
                        </Form.Item>
                      </>
                    )}
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item label="Remarks" name="remarks">
                    <Input placeholder="Optional remarks" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
                  Record Expense
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* Section 4: Transaction History */}
          <Title level={4} style={{ marginBottom: '20px', color: '#1a3042' }}>
            Transaction History
          </Title>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginBottom: '40px',
            }}
          >
            {/* Transaction History Filters */}
            <Space wrap style={{ marginBottom: '20px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Source</Text>
                <Select
                  placeholder="Filter by Source"
                  value={selectedSourceFilter}
                  onChange={handleSourceFilter}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value="IDFC BC-1">IDFC BC-1</Option>
                  <Option value="IDFC BC-2">IDFC BC-2</Option>
                  <Option value="IDFC MI-1">IDFC MI-1</Option>
                  <Option value="IDFC MI-2">IDFC MI-2</Option>
                  <Option value="CENTRAL BANK">CENTRAL BANK</Option>
                  <Option value="ICICI">ICICI</Option>
                  <Option value="CASH IN HAND">CASH IN HAND</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Branch</Text>
                {isOfficeBranch ? (
                  <Select
                    placeholder="Filter by Branch"
                    value={selectedBranchFilter}
                    onChange={handleBranchFilter}
                    allowClear
                    style={{ width: '200px' }}
                  >
                    {branches.map((branch) => (
                      <Option key={branch._id} value={branch._id}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={userBranchName}
                    readOnly
                    style={{ width: '200px', color: '#000000', background: '#f5f5f5', borderColor: '#d3d3d3' }}
                  />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Type</Text>
                <Select
                  placeholder="Filter by Type"
                  value={selectedTypeFilter}
                  onChange={handleTypeFilter}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value="Credit - Deposit">Credit - Deposit</Option>
                  <Option value="Debit - Expense">Debit - Expense</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Date Range</Text>
                <RangePicker
                  value={selectedDateRange}
                  onChange={handleDateFilter}
                  format="YYYY-MM-DD"
                  style={{ width: '250px' }}
                />
              </div>
              <Space style={{ marginTop: '20px' }}>
                <Button icon={<PrinterOutlined />} onClick={handlePrint} />
                <Button type="default" icon={<ClearOutlined />} onClick={clearFilters}>
                  Reset
                </Button>
              </Space>
            </Space>

            {/* Transaction History Table */}
            <Table
              columns={columns}
              dataSource={filteredTransactions}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              bordered
            />
          </Card>
        </div>
      </div>
    </Layout>
  );
};

FinancialManagement.useLayout = false;
export default FinancialManagement;
