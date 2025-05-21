import React, { useState, useEffect } from 'react';
import {
  Select,
  DatePicker,
  InputNumber,
  Button,
  message,
  Spin,
  Typography,
  Space,
  Card,
  Tooltip,
  Input,
  Table,
  Layout,
} from 'antd';
import { SaveOutlined, CreditCardOutlined, MobileOutlined, DollarOutlined, UnorderedListOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import BranchHeader from '../../../components/BranchHeader';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const { Option } = Select;
const { Text, Title } = Typography;

const ClosingEntry = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [closingEntryId, setClosingEntryId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [branchName, setBranchName] = useState('');
  const [userName, setUserName] = useState('User');
  const [date, setDate] = useState(dayjs());
  const [systemSales, setSystemSales] = useState(0);
  const [manualSales, setManualSales] = useState(0);
  const [onlineSales, setOnlineSales] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [expenseDetails, setExpenseDetails] = useState([
    { serialNo: 1, reason: '', recipient: '', amount: 0 },
  ]);
  const [creditCardPayment, setCreditCardPayment] = useState(0);
  const [upiPayment, setUpiPayment] = useState(0);
  const [cashPayment, setCashPayment] = useState(0);
  const [denom2000, setDenom2000] = useState(0);
  const [denom500, setDenom500] = useState(0);
  const [denom200, setDenom200] = useState(0);
  const [denom100, setDenom100] = useState(0);
  const [denom50, setDenom50] = useState(0);
  const [denom20, setDenom20] = useState(0);
  const [denom10, setDenom10] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [discrepancy, setDiscrepancy] = useState(0);
  const [lastSubmittedDate, setLastSubmittedDate] = useState(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

  // Fetch branch details for the logged-in user's branch
  const fetchBranchDetails = async (token, branchId) => {
    try {
      console.log('Fetching branch for branchId:', branchId);
      const response = await fetch(`${BACKEND_URL}/api/branches`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Branches response:', JSON.stringify(data, null, 2));
        const branch = data.find(b => b._id === branchId);
        if (branch) {
          console.log('Found branch:', JSON.stringify(branch, null, 2));
          setBranchName(branch.name || 'Unknown Branch');
          setBranchId(branchId);
        } else {
          console.error('Branch not found for branchId:', branchId);
          message.error('Branch not found');
          setBranchName('Unknown Branch');
        }
      } else {
        console.error('Failed to fetch branches, status:', response.status, 'statusText:', response.statusText);
        message.error('Failed to fetch branches');
        setBranchName('Unknown Branch');
      }
    } catch (error) {
      console.error('Fetch branches error:', error.message);
      message.error('Error fetching branch details');
      setBranchName('Unknown Branch');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.info('Please log in to access the form');
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      const decoded = jwtDecode(token);
      console.log('Decoded JWT:', decoded);
      setUserName(decoded.name || decoded.username || 'User');
      if (decoded.branchId) {
        setBranchId(decoded.branchId);
        console.log('Setting branchId:', decoded.branchId);
        fetchBranchDetails(token, decoded.branchId);
      } else {
        console.error('No branchId in JWT');
        message.error('No branch associated with this user');
        router.push('/login');
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      message.error('Invalid token, please log in again');
      router.push('/login');
    }
  }, [router]);

  // Calculate total expenses from expenseDetails and update expenses state
  useEffect(() => {
    const totalExpenses = expenseDetails.reduce((sum, detail) => sum + (detail.amount || 0), 0);
    setExpenses(totalExpenses);
  }, [expenseDetails]);

  // Recalculate totals whenever inputs change
  useEffect(() => {
    const total = (systemSales || 0) + (manualSales || 0) + (onlineSales || 0);
    setTotalSales(total);

    const totalCashFromDenom =
      (denom2000 || 0) * 2000 +
      (denom500 || 0) * 500 +
      (denom200 || 0) * 200 +
      (denom100 || 0) * 100 +
      (denom50 || 0) * 50 +
      (denom20 || 0) * 20 +
      (denom10 || 0) * 10;
    setCashPayment(totalCashFromDenom);

    const totalPay = (creditCardPayment || 0) + (upiPayment || 0) + (totalCashFromDenom || 0) + (expenses || 0);
    setTotalPayments(totalPay);

    setDiscrepancy(totalPay - total);
  }, [
    systemSales,
    manualSales,
    onlineSales,
    expenses,
    creditCardPayment,
    upiPayment,
    denom2000,
    denom500,
    denom200,
    denom100,
    denom50,
    denom20,
    denom10,
  ]);

  // Auto-clear form at 12 AM (next day)
  useEffect(() => {
    const checkMidnight = () => {
      const now = dayjs();
      const currentDate = now.format('YYYY-MM-DD');
      const lastDate = lastSubmittedDate ? dayjs(lastSubmittedDate).format('YYYY-MM-DD') : null;

      if (lastDate && currentDate !== lastDate) {
        handleClearForm();
      }
    };

    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, [lastSubmittedDate]);

  const handleAddExpense = () => {
    setExpenseDetails([...expenseDetails, { serialNo: expenseDetails.length + 1, reason: '', recipient: '', amount: 0 }]);
  };

  const handleReasonChange = (index, value) => {
    const updatedDetails = [...expenseDetails];
    updatedDetails[index].reason = value || '';
    setExpenseDetails(updatedDetails);
  };

  const handleRecipientChange = (index, value) => {
    const updatedDetails = [...expenseDetails];
    updatedDetails[index].recipient = value;
    setExpenseDetails(updatedDetails);
  };

  const handleAmountChange = (index, value) => {
    const updatedDetails = [...expenseDetails];
    updatedDetails[index].amount = value || 0;
    setExpenseDetails(updatedDetails);
  };

  const handleSubmit = async () => {
    if (!branchId) {
      message.error('Branch is required');
      return;
    }
    if (!date) {
      message.error('Please select a date');
      return;
    }
    if (systemSales === null || systemSales === undefined) {
      message.error('Please enter system sales');
      return;
    }
    if (manualSales === null || manualSales === undefined) {
      message.error('Please enter manual sales');
      return;
    }
    if (onlineSales === null || onlineSales === undefined) {
      message.error('Please enter online sales');
      return;
    }
    if (expenses === null || expenses === undefined) {
      message.error('Please enter expenses');
      return;
    }
    for (const detail of expenseDetails) {
      if (detail.amount > 0 && (!detail.reason || !detail.recipient)) {
        message.error('Please select a reason and enter a recipient for all expense amounts');
        return;
      }
    }
    if (
      creditCardPayment === null ||
      creditCardPayment === undefined ||
      upiPayment === null ||
      upiPayment === undefined ||
      cashPayment === null ||
      cashPayment === undefined
    ) {
      message.error('Please enter all payment amounts');
      return;
    }
    if (
      denom2000 === null ||
      denom2000 === undefined ||
      denom500 === null ||
      denom500 === undefined ||
      denom200 === null ||
      denom200 === undefined ||
      denom100 === null ||
      denom100 === undefined ||
      denom50 === null ||
      denom50 === undefined ||
      denom20 === null ||
      denom20 === undefined ||
      denom10 === null ||
      denom10 === undefined
    ) {
      message.error('Please enter all denomination counts');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/closing-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId,
          date: date.format('YYYY-MM-DD'),
          systemSales,
          manualSales,
          onlineSales,
          expenses,
          expenseDetails,
          creditCardPayment,
          upiPayment,
          cashPayment,
          denom2000,
          denom500,
          denom200,
          denom100,
          denom50,
          denom20,
          denom10,
        }),
      });
      const result = await response.json();
      console.log('Submit Response:', result);
      if (response.ok) {
        message.success('Closing entry submitted successfully');
        setIsSubmitted(true);
        setClosingEntryId(result.closingEntry._id);
        setLastSubmittedDate(date);
      } else {
        message.error(result.message || 'Failed to submit closing entry');
      }
    } catch (err) {
      console.error('Submission error:', err);
      message.error('Server error while submitting closing entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!closingEntryId) {
      message.error('No closing entry ID found for updating');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/closing-entries/${closingEntryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          branchId,
          date: date.format('YYYY-MM-DD'),
          systemSales,
          manualSales,
          onlineSales,
          expenses,
          expenseDetails,
          creditCardPayment,
          upiPayment,
          cashPayment,
          denom2000,
          denom500,
          denom200,
          denom100,
          denom50,
          denom20,
          denom10,
        }),
      });
      const result = await response.json();
      console.log('Update Response:', result);
      if (response.ok) {
        message.success('Closing entry updated successfully');
        setLastSubmittedDate(date);
      } else {
        message.error(result.message || 'Failed to update closing entry');
      }
    } catch (err) {
      console.error('Update error:', err);
      message.error('Server error while updating closing entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearForm = () => {
    setBranchId(branchId);
    setDate(dayjs());
    setSystemSales(0);
    setManualSales(0);
    setOnlineSales(0);
    setExpenses(0);
    setExpenseDetails([{ serialNo: 1, reason: '', recipient: '', amount: 0 }]);
    setCreditCardPayment(0);
    setUpiPayment(0);
    setCashPayment(0);
    setDenom2000(0);
    setDenom500(0);
    setDenom200(0);
    setDenom100(0);
    setDenom50(0);
    setDenom20(0);
    setDenom10(0);
    setIsSubmitted(false);
    setClosingEntryId(null);
    setLastSubmittedDate(null);
    message.success('Form cleared successfully');
  };

  // Define columns for the expense details table
  const expenseColumns = [
    {
      title: 'Serial No',
      dataIndex: 'serialNo',
      key: 'serialNo',
      width: 80,
      align: 'center',
      render: (text) => <Input value={text} disabled style={{ textAlign: 'center' }} />,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
      render: (text, record, index) => (
        <Select
          value={text}
          onChange={(value) => handleReasonChange(index, value)}
          placeholder="Select reason"
          style={{ width: '100%' }}
          size="large"
          allowClear
        >
                <Option value="MAINTENANCE">Maintenance</Option>
                <Option value="TRANSPORT">Transport</Option>
                <Option value="FUEL">Fuel</Option>
                <Option value="PACKING">Packing</Option>
                <Option value="STAFF WELFARE">Staff Welfare</Option>
                <Option value="ADVERTISEMENT">Advertisement</Option>
                <Option value="ADVANCE">Advance</Option>
                <Option value="OTHERS">Others</Option>
        </Select>
      ),
    },
    {
      title: 'Recipient/Reason',
      dataIndex: 'recipient',
      key: 'recipient',
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => handleRecipientChange(index, e.target.value)}
          placeholder="Enter recipient or reason (e.g., John Doe)"
          size="large"
        />
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'center',
      render: (text, record, index) => (
        <InputNumber
          value={text}
          onChange={(value) => handleAmountChange(index, value)}
          min={0}
          formatter={(value) => `₹${value}`}
          parser={(value) => value.replace('₹', '')}
          style={{ width: '100%' }}
          size="large"
        />
      ),
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
        <div style={{ maxWidth: '1400px', width: '100%' }}>
          {/* Main Title */}
          <Title
            level={2}
            style={{
              textAlign: 'center',
              marginBottom: '20px',
              color: '#1a3042',
              fontWeight: 'bold',
            }}
          >
            Closing Entry
          </Title>

          {/* Common Header Row */}
          <div
            style={{
              background: '#f9f9f9',
              borderRadius: '8px',
              padding: '10px 15px',
              marginBottom: '20px',
              border: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <Space size="middle">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Branch (Fixed)</Text>
                <Input
                  value={branchName || 'Loading...'}
                  readOnly
                  style={{
                    width: '180px',
                    color: '#000000',
                    background: '#f5f5f5',
                    borderColor: '#d3d3d3',
                    height: '40px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Date</Text>
                <DatePicker
                  value={date}
                  onChange={(value) => setDate(value || dayjs())}
                  format="YYYY-MM-DD"
                  style={{ width: '180px', height: '40px' }}
                  size="large"
                />
              </div>

              <Button
                type="default"
                icon={<UnorderedListOutlined />}
                onClick={() => router.push('/dealers/closing-entry/list')}
                style={{
                  background: 'linear-gradient(to right, #34495e, #1a3042)',
                  borderColor: '#34495e',
                  color: '#fff',
                  height: '40px',
                }}
              >
                Bill List
              </Button>
            </Space>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: '30px',
                alignItems: 'start',
                '@media (max-width: 1024px)': {
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: 'auto auto',
                },
                '@media (max-width: 768px)': {
                  gridTemplateColumns: '1fr',
                  gridTemplateRows: 'auto auto auto',
                },
              }}
            >
              {/* General Inputs Section */}
              <div>
                <Card
                  title={<Title level={4} style={{ margin: 0, color: '#34495e' }}>Enter General Details</Title>}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    background: '#fff',
                    transition: 'all 0.3s ease',
                    gridColumn: '1 / 2',
                    '@media (max-width: 1024px)': {
                      gridColumn: '1 / 2',
                    },
                    '@media (max-width: 768px)': {
                      gridColumn: '1 / 2',
                    },
                  }}
                  hoverable
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '150px 1fr',
                      gap: '15px',
                      alignItems: 'center',
                      marginBottom: '20px',
                    }}
                  >
                    <Text strong>System Sales (₹):</Text>
                    <InputNumber
                      value={systemSales}
                      onChange={(value) => setSystemSales(value)}
                      min={0}
                      formatter={(value) => `₹${value}`}
                      parser={(value) => value.replace('₹', '')}
                      style={{ width: '100%' }}
                      size="large"
                    />

                    <Text strong>Manual Sales (₹):</Text>
                    <InputNumber
                      value={manualSales}
                      onChange={(value) => setManualSales(value)}
                      min={0}
                      formatter={(value) => `₹${value}`}
                      parser={(value) => value.replace('₹', '')}
                      style={{ width: '100%' }}
                      size="large"
                    />

                    <Text strong>Online Sales (₹):</Text>
                    <InputNumber
                      value={onlineSales}
                      onChange={(value) => setOnlineSales(value)}
                      min={0}
                      formatter={(value) => `₹${value}`}
                      parser={(value) => value.replace('₹', '')}
                      style={{ width: '100%' }}
                      size="large"
                    />

                    <Text strong>Expenses (₹):</Text>
                    <InputNumber
                      value={expenses}
                      disabled
                      formatter={(value) => `₹${value}`}
                      parser={(value) => value.replace('₹', '')}
                      style={{ width: '100%', color: '#000' }}
                      size="large"
                    />

                    <Text strong>
                      Credit Card (₹):
                      <Tooltip title="Amount paid via credit/debit card">
                        <CreditCardOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                      </Tooltip>
                    </Text>
                    <InputNumber
                      value={creditCardPayment}
                      onChange={(value) => setCreditCardPayment(value)}
                      min={0}
                      formatter={(value) => `₹${value}`}
                      parser={(value) => value.replace('₹', '')}
                      style={{ width: '100%', color: '#000' }}
                      size="large"
                    />

                    <Text strong>
                      UPI (₹):
                      <Tooltip title="Amount paid via UPI (e.g., Google Pay, PhonePe)">
                        <MobileOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                      </Tooltip>
                    </Text>
                    <InputNumber
                      value={upiPayment}
                      onChange={(value) => setUpiPayment(value)}
                      min={0}
                      formatter={(value) => `₹${value}`}
                      parser={(value) => value.replace('₹', '')}
                      style={{ width: '100%', color: '#000' }}
                      size="large"
                    />
                  </div>
                </Card>

                {/* Expense Details Card */}
                <Card
                  title={<Title level={4} style={{ margin: 0, color: '#34495e' }}>Expense Details</Title>}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    background: '#fff',
                    transition: 'all 0.3s ease',
                    marginTop: '20px',
                    gridColumn: '1 / 2',
                    '@media (max-width: 1024px)': {
                      gridColumn: '1 / 2',
                    },
                    '@media (max-width: 768px)': {
                      gridColumn: '1 / 2',
                    },
                  }}
                  hoverable
                >
                  <Table
                    columns={expenseColumns}
                    dataSource={expenseDetails}
                    pagination={false}
                    bordered
                    rowKey={(record, index) => index}
                    style={{ marginBottom: '10px' }}
                  />
                  <Button
                    icon={<PlusOutlined />}
                    onClick={handleAddExpense}
                    style={{
                      background: '#e6f7ff',
                      borderColor: '#91d5ff',
                      color: '#1890ff',
                      borderRadius: '4px',
                      marginTop: '10px',
                      display: 'block',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }}
                  >
                    Add Expense
                  </Button>
                </Card>

                {/* Submit/Update and Clear Buttons */}
                <Space
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '20px',
                  }}
                >
                  {isSubmitted ? (
                    <>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleUpdate}
                        loading={submitting}
                        size="large"
                        style={{
                          width: '150px',
                          background: 'linear-gradient(to right, #34495e, #1a3042)',
                          borderColor: '#34495e',
                          borderRadius: '8px',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        Update
                      </Button>
                      <Button
                        type="default"
                        icon={<ClearOutlined />}
                        onClick={handleClearForm}
                        size="large"
                        style={{
                          width: '150px',
                          borderRadius: '8px',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        Clear
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSubmit}
                      loading={submitting}
                      size="large"
                      style={{
                        width: '150px',
                        background: 'linear-gradient(to right, #34495e, #1a3042)',
                        borderColor: '#34495e',
                        borderRadius: '8px',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      Submit
                    </Button>
                  )}
                </Space>
              </div>

              {/* Cash Denominations Section */}
              <Card
                title={<Title level={4} style={{ margin: 0, color: '#34495e' }}>Cash Denominations</Title>}
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  background: '#fff',
                  transition: 'all 0.3s ease',
                  gridColumn: '2 / 3',
                  '@media (max-width: 1024px)': {
                    gridColumn: '2 / 3',
                  },
                  '@media (max-width: 768px)': {
                    gridColumn: '1 / 2',
                  },
                }}
                hoverable
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    marginBottom: '20px',
                  }}
                >
                  <Text strong>
                    2000 ×
                    <Tooltip title="Enter the count of 2000 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom2000}
                    onChange={(value) => setDenom2000(value)}
                    min={0}
                    size="large"
                  />
                  <Text strong>
                    500 ×
                    <Tooltip title="Enter the count of 500 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom500}
                    onChange={(value) => setDenom500(value)}
                    min={0}
                    size="large"
                  />
                  <Text strong>
                    200 ×
                    <Tooltip title="Enter the count of 200 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom200}
                    onChange={(value) => setDenom200(value)}
                    min={0}
                    size="large"
                  />
                  <Text strong>
                    100 ×
                    <Tooltip title="Enter the count of 100 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom100}
                    onChange={(value) => setDenom100(value)}
                    min={0}
                    size="large"
                  />
                  <Text strong>
                    50 ×
                    <Tooltip title="Enter the count of 50 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom50}
                    onChange={(value) => setDenom50(value)}
                    min={0}
                    size="large"
                  />
                  <Text strong>
                    20 ×
                    <Tooltip title="Enter the count of 20 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom20}
                    onChange={(value) => setDenom20(value)}
                    min={0}
                    size="large"
                  />
                  <Text strong>
                    10 ×
                    <Tooltip title="Enter the count of 10 denomination notes">
                      <DollarOutlined style={{ marginLeft: '8px', color: '#1890ff' }} />
                    </Tooltip>
                  </Text>
                  <InputNumber
                    value={denom10}
                    onChange={(value) => setDenom10(value)}
                    min={0}
                    size="large"
                  />
                </div>
              </Card>

              {/* Summary Section */}
              <Card
                title={<Title level={4} style={{ margin: 0, color: '#34495e' }}>Summary</Title>}
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  background: '#fff',
                  transition: 'all 0.3s ease',
                  position: 'sticky',
                  top: '104px',
                  gridColumn: '3 / 4',
                  '@media (max-width: 1024px)': {
                    gridColumn: '1 / 3',
                  },
                  '@media (max-width: 768px)': {
                    gridColumn: '1 / 2',
                  },
                }}
                hoverable
              >
                <Space direction="vertical" style={{ width: '100%', fontSize: '14px' }}>
                  {/* Sales */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>System Sales:</Text>
                    <Text>₹{systemSales || 0}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Manual Sales:</Text>
                    <Text>₹{manualSales || 0}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Online Sales:</Text>
                    <Text>₹{onlineSales || 0}</Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderTop: '1px solid #e8e8e8',
                      fontWeight: 'bold',
                    }}
                  >
                    <Text strong>Total Sales:</Text>
                    <Text strong>₹{totalSales}</Text>
                  </div>

                  {/* Payment Breakdown */}
                  <div style={{ marginTop: '20px' }}>
                    <Title level={5} style={{ margin: 0, color: '#34495e' }}>
                      Payment Breakdown
                    </Title>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <Text>
                        <CreditCardOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        Credit Card:
                      </Text>
                      <Text>₹{creditCardPayment || 0}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>
                        <MobileOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        UPI:
                      </Text>
                      <Text>₹{upiPayment || 0}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>
                        <DollarOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        Cash:
                      </Text>
                      <Text>₹{cashPayment || 0}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Expenses:</Text>
                      <Text>₹{expenses || 0}</Text>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderTop: '1px solid #e8e8e8',
                        fontWeight: 'bold',
                      }}
                    >
                      <Text strong>Total Payments:</Text>
                      <Text strong>₹{totalPayments}</Text>
                    </div>
                  </div>

                  {/* Denomination Breakdown */}
                  <div style={{ marginTop: '20px' }}>
                    <Title level={5} style={{ margin: 0, color: '#34495e' }}>
                      Cash Denomination Breakdown
                    </Title>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <Text>2000 × {denom2000}:</Text>
                      <Text>₹{(denom2000 || 0) * 2000}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>500 × {denom500}:</Text>
                      <Text>₹{(denom500 || 0) * 500}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>200 × {denom200}:</Text>
                      <Text>₹{(denom200 || 0) * 200}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>100 × {denom100}:</Text>
                      <Text>₹{(denom100 || 0) * 100}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>50 × {denom50}:</Text>
                      <Text>₹{(denom50 || 0) * 50}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>20 × {denom20}:</Text>
                      <Text>₹{(denom20 || 0) * 20}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>10 × {denom10}:</Text>
                      <Text>₹{(denom10 || 0) * 10}</Text>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderTop: '1px solid #e8e8e8',
                        fontWeight: 'bold',
                      }}
                    >
                      <Text strong>Total Cash Amount:</Text>
                      <Text strong>₹{cashPayment || 0}</Text>
                    </div>
                  </div>

                  {/* Discrepancy */}
                  <div style={{ marginTop: '20px' }}>
                    <Title level={5} style={{ margin: 0, color: '#34495e' }}>
                      Discrepancy
                    </Title>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <Text>Total Sales:</Text>
                      <Text>₹{totalSales}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Total Payments:</Text>
                      <Text>₹{totalPayments}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                      <Text>Status:</Text>
                      {discrepancy === 0 ? (
                        <Text style={{ color: '#52c41a', fontSize: '14px' }}>
                          Everything OK
                        </Text>
                      ) : (
                        <Text style={{ color: '#ff4d4f', fontSize: '14px' }}>
                          Difference: ₹{discrepancy}
                        </Text>
                      )}
                    </div>
                  </div>
                </Space>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

ClosingEntry.useLayout = false;
export default ClosingEntry;