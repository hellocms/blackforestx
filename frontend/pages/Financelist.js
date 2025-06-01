import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Table, Space, DatePicker, message, Layout } from 'antd';
import { PrinterOutlined, ClearOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isBetween from 'dayjs/plugin/isBetween';
import { useRouter } from 'next/router';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title as ChartTitle, Tooltip, Legend } from 'chart.js';

dayjs.extend(utc);
dayjs.extend(isBetween);
ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    const errorHandler = (error) => {
      console.error('Chart Error:', error);
      setHasError(true);
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);
  return hasError ? <div>Chart failed to load. Check console for details.</div> : children;
};

const PaymentHistory = () => {
  // State for transactions and filters
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(null);
  const [selectedPredefinedRange, setSelectedPredefinedRange] = useState(null);
  const [chartData, setChartData] = useState(null);

  const router = useRouter();
  const BACKEND_URL = 'https://apib.dinasuvadu.in';

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        message.info('Please log in to access the page');
        router.push('/login');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/financial/transactions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
          updatedByBranch: t.updatedByBranchId?.name || 'N/A',
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

  // Fetch branches
  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/branches/public`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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

  // Prepare chart data based on date range
  const prepareChartData = (transactions, dateRange) => {
    let startDate, endDate, daysInRange;

    if (dateRange && dateRange.length === 2) {
      startDate = dayjs(dateRange[0]).startOf('day');
      endDate = dayjs(dateRange[1]).endOf('day');
      daysInRange = endDate.diff(startDate, 'day') + 1;
    } else {
      startDate = dayjs().startOf('month');
      endDate = dayjs().endOf('month');
      daysInRange = startDate.daysInMonth();
    }

    const labels = Array.from({ length: daysInRange }, (_, i) =>
      startDate.add(i, 'day').format('YYYY-MM-DD')
    );

    const creditData = new Array(daysInRange).fill(0);
    const debitData = new Array(daysInRange).fill(0);

    transactions.forEach((t) => {
      const transactionDate = dayjs(t.date);
      if (
        transactionDate.isValid() &&
        transactionDate.isBetween(startDate, endDate, null, '[]')
      ) {
        const dayIndex = transactionDate.diff(startDate, 'day');
        if (t.type === 'Credit - Deposit') {
          creditData[dayIndex] += t.amount;
        } else if (t.type === 'Debit - Expense') {
          debitData[dayIndex] += t.amount;
        }
      }
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'Credit - Deposit',
          data: creditData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          stack: 'Stack 0',
        },
        {
          label: 'Debit - Expense',
          data: debitData,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          stack: 'Stack 0',
        },
      ],
    });
  };

  // Fetch data on mount
  useEffect(() => {
    fetchTransactions();
    fetchBranches();
  }, [router]);

  // Update chart and filtered transactions when transactions or filters change
  useEffect(() => {
    filterTransactions(
      selectedSourceFilter,
      selectedTypeFilter,
      selectedDateRange,
      selectedBranchFilter
    );
  }, [transactions, selectedSourceFilter, selectedTypeFilter, selectedDateRange, selectedBranchFilter]);

  // Filter transactions
  const filterTransactions = (source, type, dateRange, branch) => {
    let filtered = [...transactions];

    if (source) {
      filtered = filtered.filter((t) => t.source === source);
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

    if (branch) {
      filtered = filtered.filter((t) => t.branchId === branch);
    }

    setFilteredTransactions(filtered);
    prepareChartData(filtered, dateRange);
  };

  // Handle filter changes
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
    setSelectedPredefinedRange(null);
    filterTransactions(selectedSourceFilter, selectedTypeFilter, dates, selectedBranchFilter);
  };

  const handleBranchFilter = (value) => {
    setSelectedBranchFilter(value);
    filterTransactions(selectedSourceFilter, selectedTypeFilter, selectedDateRange, value);
  };

  const handlePredefinedRangeFilter = (value) => {
    setSelectedPredefinedRange(value);
    setSelectedDateRange(null);
    let dateRange = null;
    const today = dayjs();

    switch (value) {
      case 'today':
        dateRange = [today, today];
        break;
      case 'yesterday':
        dateRange = [today.subtract(1, 'day'), today.subtract(1, 'day')];
        break;
      case 'last7days':
        dateRange = [today.subtract(6, 'day'), today];
        break;
      case 'last30days':
        dateRange = [today.subtract(29, 'day'), today];
        break;
      default:
        break;
    }

    filterTransactions(selectedSourceFilter, selectedTypeFilter, dateRange, selectedBranchFilter);
  };

  const clearFilters = () => {
    setSelectedSourceFilter(null);
    setSelectedTypeFilter(null);
    setSelectedDateRange(null);
    setSelectedPredefinedRange(null);
    setSelectedBranchFilter(null);
    filterTransactions(null, null, null, null);
  };

  // Print transaction history
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Payment History</title>
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
          <h1>Payment History</h1>
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
                <th>Updated By</th>
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
                      <td>${t.expenseCategory || 'N/A'}</td>
                      <td>${t.remarks || 'N/A'}</td>
                      <td>${t.updatedByBranch}</td>
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
      render: (category) => category || 'N/A',
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (remarks) => remarks || 'N/A',
    },
    {
      title: 'Updated By',
      dataIndex: 'updatedByBranch',
      key: 'updatedByBranch',
      width: 120,
    },
  ];

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: selectedDateRange || selectedPredefinedRange
          ? `Daily Credit and Debit Totals - ${selectedPredefinedRange || 'Custom Range'}`
          : 'Daily Credit and Debit Totals - June 2025',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y;
            return `${datasetLabel}: ₹${value.toFixed(2)}`;
          },
          footer: (tooltipItems) => {
            const dayIndex = tooltipItems[0].dataIndex;
            const total = (chartData?.datasets[0]?.data[dayIndex] || 0) + (chartData?.datasets[1]?.data[dayIndex] || 0);
            return `Total: ₹${total.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amount (₹)',
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f0f2f5, #e6e9f0)' }}>
      <div
        style={{
          padding: '40px 20px',
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
            Payment History
          </Title>

          {/* Bar Graph */}
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginBottom: '40px',
            }}
          >
            <ErrorBoundary>
              {chartData && <Bar data={chartData} options={chartOptions} style={{ maxHeight: '400px' }} />}
            </ErrorBoundary>
          </Card>

          {/* Transaction History */}
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
                  {branches.map((branch) => (
                    <Option key={branch._id} value={branch._id}>
                      {branch.name}
                    </Option>
                  ))}
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
                <Text strong>Predefined Date Range</Text>
                <Select
                  placeholder="Select Range"
                  value={selectedPredefinedRange}
                  onChange={handlePredefinedRangeFilter}
                  allowClear
                  style={{ width: '200px' }}
                >
                  <Option value="today">Today</Option>
                  <Option value="yesterday">Yesterday</Option>
                  <Option value="last7days">Last 7 Days</Option>
                  <Option value="last30days">Last 30 Days</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>Custom Date Range</Text>
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

export default PaymentHistory;