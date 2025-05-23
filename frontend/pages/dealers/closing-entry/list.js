import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Spin, Typography, Space, Card, Modal, Tooltip } from 'antd';
import { RedoOutlined, PrinterOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip as ChartTooltip, Legend } from 'chart.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// Register Chart.js components
ChartJS.register(LineElement, PointElement, ArcElement, CategoryScale, LinearScale, ChartTooltip, Legend);

const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const ClosingEntryList = () => {
  const [closingEntries, setClosingEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [branchFilter, setBranchFilter] = useState(null);
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [dateFilterType, setDateFilterType] = useState('Created');
  const [expenseFilter, setExpenseFilter] = useState(null);
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [expenseDetails, setExpenseDetails] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [modalTitle, setModalTitle] = useState('Expense Details');

  const expenseCategories = [
    'MAINTENANCE',
    'TRANSPORT',
    'FUEL',
    'PACKING',
    'STAFF WELFARE',
    'ADVERTISEMENT',
    'ADVANCE',
    'OTHERS',
  ];

  useEffect(() => {
    fetchBranches();
    fetchClosingEntries();
  }, []);

  useEffect(() => {
    let filtered = [...closingEntries];
    if (branchFilter) {
      filtered = filtered.filter((entry) => entry.branchId?._id === branchFilter);
    }
    if (dateRangeFilter && dateRangeFilter.length === 2) {
      const startDate = dayjs(dateRangeFilter[0]).startOf('day');
      const endDate = dayjs(dateRangeFilter[1]).endOf('day');
      filtered = filtered.filter((entry) => {
        const entryDate = dateFilterType === 'Created' ? dayjs(entry.createdAt) : dayjs(entry.date);
        return entryDate.isValid() && entryDate.isBetween(startDate, endDate, null, '[]');
      });
    }
    if (expenseFilter) {
      filtered = filtered.filter((entry) =>
        entry.expenseDetails.some((detail) => detail.reason === expenseFilter)
      );
    }
    setFilteredEntries(filtered);
  }, [closingEntries, branchFilter, dateRangeFilter, dateFilterType, expenseFilter]);

  const fetchBranches = async () => {
    try {
      const response = await fetch('https://apib.dinasuvadu.in/api/branches/public', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setBranches(result);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchClosingEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://apib.dinasuvadu.in/api/closing-entries', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok) {
        setClosingEntries(result);
        setFilteredEntries(result);
      }
    } catch (err) {
      console.error('Error fetching closing entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewExpenses = (entry) => {
    setSelectedEntryId(entry._id);
    const expenses = entry.expenseDetails || [];
    setExpenseDetails(expenses);
    const branchName = entry.branchId?.name || 'Unknown Branch';
    const formattedDate = dayjs(entry.date).format('YYYY-MM-DD');
    setModalTitle(`Expense Details for ${branchName} on ${formattedDate}`);
    setIsExpenseModalVisible(true);
  };

  const handleModalClose = () => {
    setIsExpenseModalVisible(false);
    setExpenseDetails([]);
    setSelectedEntryId(null);
    setModalTitle('Expense Details');
  };

  const handleReset = () => {
    setBranchFilter(null);
    setDateRangeFilter(null);
    setDateFilterType('Created');
    setExpenseFilter(null);
  };

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Closing Entry List</title>
          <style>
            @media print {
              @page { size: A4; margin: 20mm; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #000; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .difference { color: #ff4d4f; }
              .ok { color: #52c41a; }
            }
          </style>
        </head>
        <body>
          <h1>Closing Entry List</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Branch</th>
                <th>Date</th>
                <th>Total Sales</th>
                <th>Total Payments</th>
                <th>Difference</th>
                <th>Credit Card</th>
                <th>UPI</th>
                <th>Cash</th>
                <th>Expenses</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries
                .map(
                  (entry, index) => {
                    const sales = entry.systemSales + entry.manualSales + entry.onlineSales;
                    const payments = entry.creditCardPayment + entry.upiPayment + entry.cashPayment + entry.expenses;
                    const diff = payments - sales;
                    return `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${entry.branchId?.name || 'N/A'}</td>
                        <td>${dayjs(entry.date).format('YYYY-MM-DD')}</td>
                        <td>₹${sales}</td>
                        <td>₹${payments}</td>
                        <td class="${diff === 0 ? 'ok' : 'difference'}">
                          ₹${diff}
                        </td>
                        <td>₹${entry.creditCardPayment}</td>
                        <td>₹${entry.upiPayment}</td>
                        <td>₹${entry.cashPayment}</td>
                        <td>₹${entry.expenses}</td>
                        <td>${dayjs(entry.createdAt).format('YYYY-MM-DD hh:mm A')}</td>
                      </tr>
                    `;
                  }
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

  const lineChartData = useMemo(() => {
    const currentDate = dayjs('2025-05-23'); // Current date: May 23, 2025
    const targetMonth = currentDate.month(); // 4 (May)
    const targetYear = currentDate.year(); // 2025
    const currentDay = currentDate.date(); // 23

    // Create labels for the X-axis (dates 1 to 23)
    const labels = Array.from({ length: currentDay }, (_, i) => (i + 1).toString());

    // Initialize arrays to store daily totals
    const dailySales = Array(currentDay).fill(0);
    const dailyPayments = Array(currentDay).fill(0);
    const dailyExpenses = Array(currentDay).fill(0);

    // Process filtered entries to sum metrics by day
    filteredEntries.forEach((entry) => {
      const entryDate = dayjs(entry.date);
      if (
        entryDate.month() === targetMonth &&
        entryDate.year() === targetYear &&
        entryDate.date() <= currentDay
      ) {
        const dayIndex = entryDate.date() - 1; // 0-based index
        const sales = (entry.systemSales || 0) + (entry.manualSales || 0) + (entry.onlineSales || 0);
        const payments = (entry.creditCardPayment || 0) + (entry.upiPayment || 0) + (entry.cashPayment || 0) + (entry.expenses || 0);
        dailySales[dayIndex] += sales;
        dailyPayments[dayIndex] += payments;
        dailyExpenses[dayIndex] += entry.expenses || 0;
      }
    });

    // Calculate the maximum value for Y-axis scaling
    const maxValue = Math.max(
      ...dailySales,
      ...dailyPayments,
      ...dailyExpenses,
      1 // Avoid 0 max
    );

    return {
      labels,
      datasets: [
        {
          label: 'Total Sales',
          data: dailySales,
          borderColor: '#36A2EB',
          backgroundColor: '#36A2EB',
          fill: false,
          tension: 0.1,
        },
        {
          label: 'Total Payments',
          data: dailyPayments,
          borderColor: '#52C41A',
          backgroundColor: '#52C41A',
          fill: false,
          tension: 0.1,
        },
        {
          label: 'Expenses',
          data: dailyExpenses,
          borderColor: '#FF4D4F',
          backgroundColor: '#FF4D4F',
          fill: false,
          tension: 0.1,
        },
      ],
      maxValue,
    };
  }, [filteredEntries]);

  const lineChartOptions = {
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            weight: 'bold',
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.raw || 0;
            return `${label}: ₹${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            weight: 'bold',
          },
        },
        ticks: {
          autoSkip: false,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amount (₹)',
          font: {
            weight: 'bold',
          },
        },
        beginAtZero: true,
        max: Math.ceil(lineChartData.maxValue * 1.1), // 10% padding
        ticks: {
          callback: (value) => `₹${value}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  const pieChartData = useMemo(() => {
    const expenseTotals = {};
    let totalExpenses = 0;

    filteredEntries.forEach((entry) => {
      entry.expenseDetails.forEach((detail) => {
        const reason = expenseCategories.includes(detail.reason) ? detail.reason : 'OTHERS';
        const amount = detail.amount || 0;
        expenseTotals[reason] = (expenseTotals[reason] || 0) + amount;
        totalExpenses += amount;
      });
    });

    const labels = [];
    const data = [];
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#C9CBCF',
      '#7BC225',
    ];

    const allCategories = [...expenseCategories];
    allCategories.forEach((category) => {
      const amount = expenseTotals[category] || 0;
      const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(2) : 0;
      if (amount > 0) {
        labels.push(`${category}: ${percentage}%`);
        data.push(amount);
      }
    });

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredEntries]);

  const pieChartOptions = {
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: {
            weight: 'bold',
          },
          boxWidth: 20,
          padding: 10,
          generateLabels: (chart) => {
            const { data } = chart;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const meta = chart.getDatasetMeta(0);
                const style = meta.controller.getStyle(i);
                const [name, percentage] = label.split(': ');
                return {
                  text: [name, `: ${percentage}`],
                  fillStyle: style.backgroundColor,
                  strokeStyle: style.borderColor,
                  lineWidth: style.borderWidth,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            }
            return [];
          },
        },
        maxWidth: 250,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ₹${value} (${percentage}%)`;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  const expenseColumns = [
    {
      title: 'S.No',
      key: 'sno',
      render: (text, record, index) => index + 1,
      width: 80,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (value) => value || 'N/A',
    },
    {
      title: 'Recipient',
      dataIndex: 'recipient',
      key: 'recipient',
      render: (value) => value || 'N/A',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (value) => `₹${value || 0}`,
      align: 'right',
    },
  ];

  const columns = [
    {
      title: 'S.No',
      key: 'sno',
      render: (text, record, index) => index + 1,
      width: 60,
    },
    {
      title: 'Branch',
      dataIndex: ['branchId', 'name'],
      key: 'branch',
      render: (value) => value || 'N/A',
      width: 120,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      width: 100,
    },
    {
      title: 'Total Sales',
      key: 'totalSales',
      sorter: (a, b) => (a.systemSales + a.manualSales + a.onlineSales) - (b.systemSales + b.manualSales + b.onlineSales),
      render: (record) => `₹${record.systemSales + record.manualSales + record.onlineSales}`,
      width: 120,
    },
    {
      title: 'Total Payments',
      key: 'totalPayments',
      sorter: (a, b) => (a.creditCardPayment + a.upiPayment + a.cashPayment + a.expenses) - (b.creditCardPayment + b.upiPayment + b.cashPayment + b.expenses),
      render: (record) => `₹${record.creditCardPayment + record.upiPayment + record.cashPayment + record.expenses}`,
      width: 120,
    },
    {
      title: 'Difference',
      key: 'difference',
      render: (record) => {
        const sales = record.systemSales + record.manualSales + record.onlineSales;
        const payments = record.creditCardPayment + record.upiPayment + record.cashPayment + record.expenses;
        const diff = payments - sales;
        return (
          <Text style={{ color: diff === 0 ? '#52c41a' : '#ff4d4f' }}>
            ₹{diff}
          </Text>
        );
      },
      width: 120,
    },
    {
      title: 'Credit Card',
      dataIndex: 'creditCardPayment',
      key: 'creditCardPayment',
      render: (value) => `₹${value}`,
      width: 120,
    },
    {
      title: 'UPI',
      dataIndex: 'upiPayment',
      key: 'upiPayment',
      render: (value) => `₹${value}`,
      width: 120,
    },
    {
      title: 'Cash',
      dataIndex: 'cashPayment',
      key: 'cashPayment',
      render: (value) => `₹${value}`,
      width: 120,
    },
    {
      title: 'Expenses',
      dataIndex: 'expenses',
      key: 'expenses',
      render: (value, record) => (
        <Space>
          <span>₹{value}</span>
          {value > 0 && (
            <Tooltip title="View Expense Details">
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => handleViewExpenses(record)}
                style={{ padding: 0 }}
              />
            </Tooltip>
          )}
        </Space>
      ),
      width: 140,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (date) => dayjs(date).format('YYYY-MM-DD hh:mm A'),
      width: 160,
    },
  ];

  return (
    <div
      style={{
        padding: '40px 20px',
        background: 'linear-gradient(to bottom, #f0f2f5, #e6e9f0)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <style>
        {`
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            .ant-card, .graphs-section {
              display: none;
            }
            .ant-table {
              font-size: 10px;
            }
            .ant-table th, .ant-table td {
              padding: 4px !important;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
          }
          .chart-container.line {
            width: 60vw;
            max-width: 900px;
            height: 50vh;
            min-height: 400px;
            min-width: 600px;
          }
          .chart-container.pie {
            width: 30vw;
            max-width: 500px;
            height: 50vh;
            min-height: 400px;
            min-width: 400px;
          }
          @media (max-width: 1024px) {
            .chart-container.line {
              width: 95vw;
              min-width: 600px;
              height: 45vh;
              min-height: 350px;
            }
            .chart-container.pie {
              width: 50vw;
              min-width: 350px;
              height: 40vh;
              min-height: 350px;
            }
          }
          @media (max-width: 768px) {
            .chart-container.line {
              width: 98vw;
              min-width: 400px;
              height: 40vh;
              min-height: 300px;
            }
            .chart-container.pie {
              width: 98vw;
              min-width: 300px;
              height: 35vh;
              min-height: 300px;
            }
          }
          @media (max-width: 480px) {
            .chart-container.line {
              width: 98vw;
              min-width: 300px;
              height: 35vh;
              min-height: 250px;
            }
            .chart-container.pie {
              width: 98vw;
              min-width: 300px;
              height: 30vh;
              min-height: 250px;
            }
          }
        `}
      </style>
      <div style={{ maxWidth: '1600px', width: '100%' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Card
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              <Space wrap style={{ width: '100%', padding: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Text strong>Branch</Text>
                  <Select
                    placeholder="All Branches"
                    value={branchFilter}
                    onChange={(value) => setBranchFilter(value)}
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
                  <Text strong>Date Filter</Text>
                  <Space>
                    <Select
                      value={dateFilterType}
                      onChange={(value) => setDateFilterType(value)}
                      style={{ width: '120px' }}
                    >
                      <Option value="Created">Created</Option>
                      <Option value="Date">Date</Option>
                    </Select>
                    <RangePicker
                      value={dateRangeFilter}
                      onChange={(dates) => setDateRangeFilter(dates)}
                      format="YYYY-MM-DD"
                      style={{ width: '250px' }}
                    />
                  </Space>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Text strong>Expense Reason</Text>
                  <Select
                    placeholder="All Expenses"
                    value={expenseFilter}
                    onChange={(value) => setExpenseFilter(value)}
                    allowClear
                    style={{ width: '200px' }}
                  >
                    <Option value={null}>All Expenses</Option>
                    <Option value="MAINTENANCE">Maintenance</Option>
                    <Option value="TRANSPORT">Transport</Option>
                    <Option value="FUEL">Fuel</Option>
                    <Option value="PACKING">Packing</Option>
                    <Option value="STAFF WELFARE">Staff Welfare</Option>
                    <Option value="ADVERTISEMENT">Advertisement</Option>
                    <Option value="ADVANCE">Advance</Option>
                    <Option value="OTHERS">Others</Option>
                  </Select>
                </div>

                <Space style={{ marginTop: '20px' }}>
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                  />
                  <Button
                    type="default"
                    icon={<RedoOutlined />}
                    onClick={handleReset}
                  >
                    Reset
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    href="http://localhost:3000/dealers/closing-entry/closingentry"
                  >
                    Create Closing Bill
                  </Button>
                </Space>
              </Space>
            </Card>

            <Card
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              <Table
                columns={columns}
                dataSource={filteredEntries}
                rowKey="_id"
                pagination={{ pageSize: 10 }}
                bordered
              />
            </Card>

            <Card
              className="graphs-section"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                background: '#fff',
                marginBottom: '20px',
              }}
            >
              {filteredEntries.length > 0 ? (
                <Space
                  direction="horizontal"
                  style={{
                    width: '100%',
                    padding: '20px',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                      Daily Trends (May 2025)
                    </Text>
                    <div className="chart-container line">
                      <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                      Expense Breakdown
                    </Text>
                    <div className="chart-container pie">
                      <Pie data={pieChartData} options={pieChartOptions} />
                    </div>
                  </div>
                </Space>
              ) : (
                <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                  No data to display
                </Text>
              )}
            </Card>

            <Modal
              title={modalTitle}
              open={isExpenseModalVisible}
              onCancel={handleModalClose}
              footer={null}
              width={600}
            >
              {expenseDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text>No expense details available.</Text>
                </div>
              ) : (
                <Table
                  columns={expenseColumns}
                  dataSource={expenseDetails}
                  rowKey={(record, index) => index}
                  pagination={false}
                  bordered
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3} align="right">
                        <Text strong>Total Amount</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong>
                          ₹{expenseDetails.reduce((sum, item) => sum + (item.amount || 0), 0)}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              )}
            </Modal>
          </>
        )}
      </div>
    </div>
  );
};

export default ClosingEntryList;