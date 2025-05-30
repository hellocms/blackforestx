import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Form, Select, InputNumber, Input, Button, Table, Space, DatePicker, message, Layout } from 'antd';
import { BankOutlined, MoneyCollectOutlined, PrinterOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode';
import BranchHeader from '../../../components/BranchHeader';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const FinancialManagement = () => {
  const [bankABalance, setBankABalance] = useState(0);
  const [bankBBalance, setBankBBalance] = useState(0);
  const [bankCBalance, setBankCBalance] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [branchName, setBranchName] = useState('Loading...');
  const [branchId, setBranchId] = useState(null);
  const [depositForm] = Form.useForm();
  const [expenseForm] = Form.useForm();
  const router = useRouter();

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.dinasuvadu.in';

  // Fetch Branch Details
  const fetchBranchDetails = async (token, branchId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const branch = data.find((b) => b._id === branchId);
        if (branch) {
          setBranchName(branch.name || 'Unknown Branch');
          setBranchId(branchId);
          depositForm.setFieldsValue({ branch: branchId });
          expenseForm.setFieldsValue({ branch: branchId });
        } else {
          message.error('Branch not found');
          setBranchName('Unknown Branch');
        }
      } else {
        message.error('Failed to fetch branches');
        setBranchName('Unknown Branch');
      }
    } catch (error) {
      console.error('Fetch branches error:', error);
      message.error('Error fetching branches');
      setBranchName('Unknown Branch');
    }
  };

  // Fetch balances
  const fetchBalances = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/balances`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        result.forEach((balance) => {
          switch (balance.source) {
            case 'Bank A':
              setBankABalance(balance.balance);
              break;
            case 'Bank B':
              setBankBBalance(balance.balance);
              break;
            case 'Bank C':
              setBankCBalance(balance.balance);
              break;
            case 'Cash-in-Hand':
              setCashBalance(balance.balance);
              break;
            default:
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
        setFilteredTransactions(formattedTransactions);
      } else {
        message.error(result.message || 'Failed to fetch transactions');
      }
    } catch (err) {
      message.error('Server error while fetching transactions');
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

  // Handle deposit form submission
  const handleDeposit = async (values) => {
    const { source, amount, remarks } = values;

    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ source, amount, branch: branchId, remarks }),
      });
      const result = await response.json();
      if (response.ok) {
        switch (source) {
          case 'Bank A':
            setBankABalance(result.balance.balance);
            break;
          case 'Bank B':
            setBankBBalance(result.balance.balance);
            break;
          case 'Bank C':
            setBankCBalance(result.balance.balance);
            break;
          case 'Cash-in-Hand':
            setCashBalance(result.balance.balance);
            break;
          default:
            break;
        }

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
    const { source, category, amount, remarks } = values;

    try {
      const response = await fetch(`${BACKEND_URL}/api/financial/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ source, category, amount, branch: branchId, remarks }),
      });
      const result = await response.json();
      if (response.ok) {
        switch (source) {
          case 'Bank A':
            setBankABalance(result.balance.balance);
            break;
          case 'Bank B':
            setBankBBalance(result.balance.balance);
            break;
          case 'Bank C':
            setBankCBalance(result.balance.balance);
            break;
          case 'Cash-in-Hand':
            setCashBalance(result.balance.balance);
            break;
          default:
            break;
        }

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
  const filterTransactions = (source, branch, type, dateRange) => {
    let filtered = [...transactions];

    if (source) {
      filtered = filtered.filter((t) => t.source === source);
    }

    if (branch) {
      filtered = filtered.filter((t) => t.branchId === branch);
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
    filterTransactions(value, selectedBranchFilter, selectedTypeFilter, selectedDateRange);
  };

  const handleBranchFilter = (value) => {
    setSelectedBranchFilter(value);
    filterTransactions(selectedSourceFilter, value, selectedTypeFilter, selectedDateRange);
  };

  const handleTypeFilter = (value) => {
    setSelectedTypeFilter(value);
    filterTransactions(selectedSourceFilter, selectedBranchFilter, value, selectedDateRange);
  };

  const handleDateFilter = (dates) => {
    setSelectedDateRange(dates);
    filterTransactions(selectedSourceFilter, selectedBranchFilter, selectedTypeFilter, dates);
  };

  const clearFilters = () => {
    setSelectedSourceFilter(null);
    setSelectedBranchFilter(null);
    setSelectedTypeFilter(null);
    setSelectedDateRange(null);
    setFilteredTransactions(transactions);
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

  // Initial data fetch
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.info('Please log in to access the form');
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded.branchId) {
        setBranchId(decoded.branchId);
        fetchBranchDetails(token, decoded.branchId);
      } else {
        message.error('No branch associated with this user');
        router.push('/login');
      }
      fetchBalances();
      fetchTransactions();
    } catch (error) {
      console.error('Error decoding token:', error);
      message.error('Invalid token, please log in again');
      router.push('/login');
    }
  }, [router, depositForm, expenseForm]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <BranchHeader />
      <div
        style={{
          padding: '104px 20px 40px 20px',
          background: 'linear-gradient(to bottom, #f0f2f5, #e6e9f0)',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
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

          {/* Section 1: Current Balances Overview */}
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
                  Bank A: ₹{bankABalance.toFixed(2)}
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
                  Bank B: ₹{bankBBalance.toFixed(2)}
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
                  Bank C: ₹{bankCBalance.toFixed(2)}
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
                <MoneyCollectOutlined style={{ fontSize: '24px', color: '#1a3042' }} />
                <Text strong style={{ fontSize: '18px', display: 'block', marginTop: '10px' }}>
                  Cash-in-Hand: ₹{cashBalance.toFixed(2)}
                </Text>
              </Card>
            </Col>
          </Row>

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
                      <Option value="Bank A">Bank A</Option>
                      <Option value="Bank B">Bank B</Option>
                      <Option value="Bank C">Bank C</Option>
                      <Option value="Cash-in-Hand">Cash-in-Hand</Option>
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
                  <Form.Item label="Branch (Fixed)">
                    <Input
                      value={branchName}
                      readOnly
                      style={{ background: '#f5f5f5', color: '#000' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="branch"
                    rules={[{ required: true, message: 'Branch is required' }]}
                    hidden
                  >
                    <Input hidden />
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
                      <Option value="Bank A">Bank A</Option>
                      <Option value="Bank B">Bank B</Option>
                      <Option value="Bank C">Bank C</Option>
                      <Option value="Cash-in-Hand">Cash-in-Hand</Option>
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
                    label="Amount (₹)"
                    name="amount"
                    rules={[{ validator: validateAmount }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Branch (Fixed)">
                    <Input
                      value={branchName}
                      readOnly
                      style={{ background: '#f5f5f5', color: '#000' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="branch"
                    rules={[{ required: true, message: 'Branch is required' }]}
                    hidden
                  >
                    <Input hidden />
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
                  <Option value="Bank A">Bank A</Option>
                  <Option value="Bank B">Bank B</Option>
                  <Option value="Bank C">Bank C</Option>
                  <Option value="Cash-in-Hand">Cash-in-Hand</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Branch</Text>
                <Select
                  placeholder="Filter by Branch"
                  value={selectedBranchFilter}
                  onChange={handleBranchFilter}
                  allowClear
                  style={{ width: '200px' }}
                >
                  {branchId && branchName && (
                    <Option value={branchId}>{branchName}</Option>
                  )}
                </Select>
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