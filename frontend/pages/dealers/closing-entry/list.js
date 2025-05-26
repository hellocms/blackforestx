import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Spin, Typography, Space, Card, Modal, Tooltip } from 'antd';
import { RedoOutlined, PrinterOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

// Register Chart.js components and the datalabels plugin
ChartJS.register(LineElement, PointElement, ArcElement, BarElement, CategoryScale, LinearScale, ChartTooltip, Legend, ChartDataLabels);

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
              .difference-equal { background-color: #52c41a; color: #ffffff; font-weight: bold; }
              .difference-less { background-color: #ff4d4f; color: #ffffff; font-weight: bold; }
              .difference-more { background-color: #fadb14; color: #000000; font-weight: bold; }
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
                    let diffClass = 'difference-equal';
                    if (diff < 0) diffClass = 'difference-less';
                    else if (diff > 0) diffClass = 'difference-more';
                    return `
                      <tr>
                        <td>${index + 1}</td>
                        <td>${entry.branchId?.name || 'N/A'}</td>
                        <td>${dayjs(entry.date).format('YYYY-MM-DD')}</td>
                        <td>₹${sales}</td>
                        <td>₹${payments}</td>
                        <td class="${diffClass}">
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
    const currentDate = dayjs('2025-05-01'); // Start of May 2025
    const targetMonth = currentDate.month(); // 4 (May)
    const targetYear = currentDate.year(); // 2025
    const daysInMonth = 31; // May has 31 days

    // Create labels for the X-axis (dates 1 to 31)
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    // Initialize arrays to store daily totals (size 31 for all days in May)
    const dailySales = Array(daysInMonth).fill(0);
    const dailyPayments = Array(daysInMonth).fill(0);
    const dailyExpenses = Array(daysInMonth).fill(0);

    // Process filtered entries to sum metrics by day
    filteredEntries.forEach((entry) => {
      const entryDate = dayjs(entry.date);
      if (
        entryDate.month() === targetMonth &&
        entryDate.year() === targetYear
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
    layout: {
      padding: {
        left: 0, // Minimize left padding
        right: 0, // Minimize right padding
        top: 20, // Keep some padding for data labels
        bottom: 0, // Minimize bottom padding
      },
    },
    plugins: {
      legend: {
        display: false, // Disable the default Chart.js legend
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
      datalabels: {
        display: true,
        color: '#FF0000', // Red color for amount numbers
        formatter: (value) => `₹${value}`,
        align: 'top',
        anchor: 'end',
        offset: 5,
        font: {
          weight: 'bold',
          size: 10,
        },
        textAlign: 'center',
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
          padding: 0, // Minimize padding around ticks
        },
        grid: {
          offset: false, // Ensure grid lines align with ticks
        },
        offset: false, // Remove extra space at the start and end of the axis
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

  // Custom legend for the line chart
  const customLineChartLegend = lineChartData.datasets.map((dataset, index) => {
    const total = dataset.data.reduce((sum, value) => sum + (value || 0), 0);
    return (
      <div key={index} style={{ display: 'flex', alignItems: 'center', marginRight: '20px' }}>
        <span
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: dataset.backgroundColor,
            marginRight: '8px',
            borderRadius: '3px',
          }}
        ></span>
        <Text strong style={{ fontSize: '20px' }}>
          {dataset.label}: ₹{total}
        </Text>
      </div>
    );
  });

  const barChartData = useMemo(() => {
    // Aggregate total sales per branch
    const salesByBranch = {};
    filteredEntries.forEach((entry) => {
      const branchName = entry.branchId?.name || 'Unknown Branch';
      const sales = (entry.systemSales || 0) + (entry.manualSales || 0) + (entry.onlineSales || 0);
      salesByBranch[branchName] = (salesByBranch[branchName] || 0) + sales;
    });

    const labels = Object.keys(salesByBranch);
    const data = Object.values(salesByBranch);

    // Calculate the maximum value for Y-axis scaling
    const maxValue = Math.max(...data, 1); // Avoid 0 max

    return {
      labels,
      datasets: [
        {
          label: 'Total Sales',
          data,
          backgroundColor: '#9966FF', // Purple color for bars
          borderColor: '#9966FF',
          borderWidth: 1,
        },
      ],
      maxValue,
    };
  }, [filteredEntries]);

  const barChartOptions = {
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
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ₹${value}`;
          },
        },
      },
      datalabels: {
        color: '#FF0000', // Red color for labels
        anchor: 'end',
        align: 'top',
        offset: 5,
        formatter: (value) => `₹${value}`,
        font: {
          weight: 'bold',
          size: 12,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Branch',
          font: {
            weight: 'bold',
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Total Sales (₹)',
          font: {
            weight: 'bold',
          },
        },
        beginAtZero: true,
        max: Math.ceil(barChartData.maxValue * 1.1), // 10% padding
        ticks: {
          callback: (value) => `₹${value}`,
        },
      },
    },
    maintainAspectRatio: false,
    barThickness: 30, // Reduce bar width
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
      if (amount > 0) {
        labels.push(category);
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
        position: 'bottom',
        align: 'start', // Align to the left
        labels: {
          color: '#000',
          font: {
            weight: 'bold',
            size: 14,
          },
          boxWidth: 20,
          padding: 10,
          generateLabels: (chart) => {
            const { data } = chart;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const meta = chart.getDatasetMeta(0);
                const style = meta.controller.getStyle(i);
                const value = data.datasets[0].data[i];
                const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                return {
                  text: `${label}: ₹${value} (${percentage}%)`,
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
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#fff',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return [`${label}: ₹${value}`, `(${percentage}%)`];
          },
        },
      },
      datalabels: {
        display: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 0.5; // Show labels for segments >= 0.5%
        },
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 3,
        padding: 6,
        formatter: (value, context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
          console.log(`Category: ${context.chart.data.labels[context.dataIndex]}, Label: ₹${value} (${percentage}%), Percentage: ${percentage}%`);
          return `₹${value} (${percentage}%)`; // Show both amount and percentage
        },
        align: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? 'end' : 'center'; // Near edge for 1-3%, center otherwise
        },
        anchor: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? 'end' : 'center'; // Near edge for 1-3%, center otherwise
        },
        offset: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? -10 : 0; // Slight inward offset for 1-3%
        },
        font: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          let fontSize;
          if (percentage < 1) {
            fontSize = 10;
          } else if (percentage <= 5) {
            fontSize = 14;
          } else {
            fontSize = 16;
          }
          return {
            weight: 'bold',
            size: fontSize,
          };
        },
        textAlign: 'center',
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
        let backgroundColor, textColor;
        if (diff === 0) {
          backgroundColor = '#52c41a'; // Green background
          textColor = '#ffffff'; // White text
        } else if (diff < 0) {
          backgroundColor = '#ff4d4f'; // Red background
          textColor = '#ffffff'; // White text
        } else {
          backgroundColor = '#fadb14'; // Yellow background
          textColor = '#000000'; // Black text
        }
        return (
          <Text style={{ backgroundColor, color: textColor, fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px' }}>
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
          .graphs-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            gap: 20px;
          }
          .upper-graphs {
            display: flex;
            flex-direction: row;
            justify-content: flex-start; /* Align to the left */
            width: 100%;
            max-width: 1600px; /* Match table width */
            gap: 20px;
          }
          .lower-graphs {
            display: flex;
            flex-direction: row;
            justify-content: center;
            width: 100%;
            max-width: 1600px; /* Match table width */
            gap: 20px;
          }
          .chart-container.line {
            width: 100%; /* Full width of parent */
            max-width: 1600px; /* Match the combined width of bottom graphs */
            height: 50vh;
            min-height: 400px;
            min-width: 900px;
          }
          .chart-container.bar {
            width: 50%; /* 50% of container */
            max-width: 800px; /* 50% of 1600px */
            height: 50vh;
            min-height: 400px;
            min-width: 400px;
          }
          .chart-container.pie {
            display: flex;
            justify-content: center; /* Center the pie chart */
            align-items: center; /* Vertically center */
            width: 50%; /* 50% of container */
            max-width: 800px; /* 50% of 1600px */
            height: 60vh;
            min-height: 450px;
            min-width: 450px;
          }
          .pie-card, .line-card, .bar-card {
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            background: #fff;
            padding: 20px;
            display: flex;
            justify-content: flex-start; /* Align content to the left for line-card */
            align-items: center; /* Vertically center */
          }
          .pie-card {
            max-width: 800px; /* Match chart-container.pie */
            justify-content: center; /* Keep pie chart centered */
          }
          .line-card {
            max-width: 1600px; /* Match chart-container.line */
          }
          .bar-card {
            max-width: 800px; /* Match chart-container.bar */
            justify-content: center; /* Keep bar chart centered */
          }
          /* Style for pie chart legend to stack vertically */
          .chart-legend-bottom-left {
            display: flex;
            flex-direction: column; /* Stack vertically */
            align-items: flex-start; /* Align to the left */
            padding: 10px 0;
          }
          .chart-legend-bottom-left .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px; /* Space between items */
          }
          .chart-legend-bottom-left .legend-item span {
            margin-right: 8px; /* Space between color box and text */
          }
          @media (max-width: 1200px) {
            .upper-graphs {
              flex-direction: column;
              align-items: flex-start; /* Align to the left */
            }
            .lower-graphs {
              flex-direction: column;
              align-items: center;
            }
            .chart-container.line {
              width: 95vw;
              max-width: 1200px; /* Adjusted to match combined width at this breakpoint */
              min-width: 700px;
              height: 45vh;
              min-height: 350px;
            }
            .chart-container.bar {
              width: 95vw;
              max-width: 600px;
              min-width: 500px;
              height: 45vh;
              min-height: 350px;
            }
            .chart-container.pie {
              justify-content: center;
              align-items: center;
              width: 95vw;
              max-width: 600px;
              min-width: 500px;
              height: 55vh;
              min-height: 400px;
            }
            .line-card, .bar-card, .pie-card {
              max-width: 100%;
            }
          }
          @media (max-width: 768px) {
            .chart-container.line {
              width: 98vw;
              max-width: 1000px; /* Adjusted to match combined width at this breakpoint */
              min-width: 400px;
              height: 40vh;
              min-height: 300px;
            }
            .chart-container.bar {
              width: 98vw;
              max-width: 500px;
              min-width: 400px;
              height: 40vh;
              min-height: 300px;
            }
            .chart-container.pie {
              width: 98vw;
              max-width: 500px;
              min-width: 400px;
              height: 50vh;
              min-height: 350px;
            }
          }
          @media (max-width: 480px) {
            .chart-container.line {
              width: 98vw;
              max-width: 850px; /* Adjusted to match combined width at this breakpoint */
              min-width: 300px;
              height: 35vh;
              min-height: 250px;
            }
            .chart-container.bar {
              width: 98vw;
              max-width: 400px;
              min-width: 300px;
              height: 35vh;
              min-height: 250px;
            }
            .chart-container.pie {
              width: 98vw;
              max-width: 400px;
              min-width: 350px;
              height: 45vh;
              min-height: 300px;
            }
          }
          @media (max-width: 768px) {
            .custom-legend {
              flex-direction: column;
              align-items: flex-start;
            }
            .custom-legend > div {
              margin-bottom: 10px;
              margin-right: 0;
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

            {filteredEntries.length > 0 ? (
              <div className="graphs-section">
                <Card className="line-card">
                  <div style={{ textAlign: 'left' }}>
                    <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                      Daily Trends (May 2025)
                    </Text>
                    <div
                      className="custom-legend"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginBottom: '20px',
                      }}
                    >
                      {customLineChartLegend}
                    </div>
                    <div className="chart-container line">
                      <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                  </div>
                </Card>
                <div className="lower-graphs">
                  <Card className="pie-card">
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                        Expense Breakdown
                      </Text>
                      <div className="chart-container pie">
                        <Pie data={pieChartData} options={pieChartOptions} />
                      </div>
                    </div>
                  </Card>
                  <Card className="bar-card">
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                        Top Sales by Branch
                      </Text>
                      <div className="chart-container bar">
                        <Bar data={barChartData} options={barChartOptions} />
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <Card
                className="graphs-section"
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  background: '#fff',
                  marginBottom: '20px',
                }}
              >
                <Text style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
                  No data to display
                </Text>
              </Card>
            )}

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