import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, DatePicker, Button, Spin, Typography, Space, Card, Modal, Tooltip, Switch } from 'antd';
import { RedoOutlined, PrinterOutlined } from '@ant-design/icons';
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
  const [dateFilter, setDateFilter] = useState('Today'); // Default to Today
  const [customDateRange, setCustomDateRange] = useState(null);
  const [dateFilterType, setDateFilterType] = useState('Created');
  const [expenseFilter, setExpenseFilter] = useState(null);
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [expenseDetails, setExpenseDetails] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [modalTitle, setModalTitle] = useState('Expense Details');
  const [showSummaryTable, setShowSummaryTable] = useState(true); // Default to summary view

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

    // Apply branch filter
    if (branchFilter) {
      filtered = filtered.filter((entry) => entry.branchId?._id === branchFilter);
    }

    // Apply date filter
    if (dateFilter) {
      let startDate, endDate;
      const today = dayjs().startOf('day');
      switch (dateFilter) {
        case 'Today':
          startDate = today;
          endDate = today.endOf('day');
          break;
        case 'Yesterday':
          startDate = today.subtract(1, 'day').startOf('day');
          endDate = today.subtract(1, 'day').endOf('day');
          break;
        case 'Last 7 Days':
          startDate = today.subtract(6, 'day').startOf('day');
          endDate = today.endOf('day');
          break;
        case 'Last 30 Days':
          startDate = today.subtract(29, 'day').startOf('day');
          endDate = today.endOf('day');
          break;
        case 'Custom':
          if (customDateRange && customDateRange.length === 2) {
            startDate = dayjs(customDateRange[0]).startOf('day');
            endDate = dayjs(customDateRange[1]).endOf('day');
          }
          break;
        default:
          break;
      }
      if (startDate && endDate) {
        filtered = filtered.filter((entry) => {
          const entryDate = dateFilterType === 'Created' ? dayjs(entry.createdAt) : dayjs(entry.date);
          return entryDate.isValid() && entryDate.isBetween(startDate, endDate, null, '[]');
        });
      }
    }

    // Apply expense filter
    if (expenseFilter) {
      filtered = filtered.filter((entry) =>
        entry.expenseDetails.some((detail) => detail.reason === expenseFilter)
      );
    }

    setFilteredEntries(filtered);
  }, [closingEntries, branchFilter, dateFilter, customDateRange, dateFilterType, expenseFilter]);

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

  const handleViewExpenses = (entry, branchName, date) => {
    setSelectedEntryId(entry._id || entry.branchId);
    const expenses = entry.expenseDetails || [];
    setExpenseDetails(expenses);
    const formattedDate = date ? dayjs(date).format('D/M/YY') : 'Summary';
    setModalTitle(`Expense Details for ${branchName || 'Unknown Branch'} ${date ? `on ${formattedDate}` : ''}`);
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
    setDateFilter('Today');
    setCustomDateRange(null);
    setDateFilterType('Created');
    setExpenseFilter(null);
  };

  const handlePrint = () => {
    let printContent;
    if (showSummaryTable) {
      printContent = `
        <html>
          <head>
            <title>Branch Summary Report</title>
            <style>
              @media print {
                @page { size: A4; margin: 20mm; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .difference-equal { background-color: #52c41a; color: #ffffff; font-weight: bold; }
                .difference-less { background-color: #ff4d4f; color: #ffffff; font-weight: bold; }
                .difference-more { background-color: #fadb14; color: #000000; font-weight: bold; }
                .total-sales { background-color: rgb(220, 248, 198); }
                .total-payments { background-color: #50e0ff; }
              }
            </style>
          </head>
          <body>
            <h1>Branch Summary Report</h1>
            <h3>Period: ${dateFilter}${dateFilter === 'Custom' && customDateRange ? ` (${dayjs(customDateRange[0]).format('D/M/YY')} to ${dayjs(customDateRange[1]).format('D/M/YY')})` : ''}</h3>
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Branch</th>
                  <th>Credit Card</th>
                  <th>UPI</th>
                  <th>Cash</th>
                  <th>Expenses</th>
                  <th class="total-sales">Total Sales</th>
                  <th class="total-payments">Total Payments</th>
                  <th>Difference</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                ${branchTotals.map((entry, index) => {
                  const diff = entry.totalPayments - entry.totalSales;
                  let diffClass = 'difference-equal';
                  if (diff < 0) diffClass = 'difference-less';
                  else if (diff > 0) diffClass = 'difference-more';
                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${entry.branchName || 'N/A'}</td>
                      <td>₹${entry.creditCardPayment}</td>
                      <td>₹${entry.upiPayment}</td>
                      <td>₹${entry.cashPayment}</td>
                      <td>₹${entry.expenses}</td>
                      <td class="total-sales">₹${entry.totalSales}</td>
                      <td class="total-payments">₹${entry.totalPayments}</td>
                      <td class="${diffClass}">₹${diff}</td>
                      <td>${entry.createdAt ? dayjs(entry.createdAt).format('D/M/YY') : 'N/A'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
    } else {
      printContent = `
        <html>
          <head>
            <title>Closing Entry List</title>
            <style>
              @media print {
                @page { size: A4; margin: 20mm; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .difference-equal { background-color: #52c41a; color: #ffffff; font-weight: bold; }
                .difference-less { background-color: #ff4d4f; color: #ffffff; font-weight: bold; }
                .difference-more { background-color: #fadb14; color: #000000; font-weight: bold; }
                .total-sales { background-color: rgb(220, 248, 198); }
                .total-payments { background-color: #50e0ff; }
              }
            </style>
          </head>
          <body>
            <h1>Closing Entry List</h1>
            <h3>Period: ${dateFilter}${dateFilter === 'Custom' && customDateRange ? ` (${dayjs(customDateRange[0]).format('D/M/YY')} to ${dayjs(customDateRange[1]).format('D/M/YY')})` : ''}</h3>
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Branch</th>
                  <th>Date</th>
                  <th>Credit Card</th>
                  <th>UPI</th>
                  <th>Cash</th>
                  <th>Expenses</th>
                  <th class="total-sales">Total Sales</th>
                  <th class="total-payments">Total Payments</th>
                  <th>Difference</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                ${filteredEntries.map((entry, index) => {
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
                      <td>${dayjs(entry.date).format('MMM-DD')}</td>
                      <td>₹${entry.creditCardPayment}</td>
                      <td>₹${entry.upiPayment}</td>
                      <td>₹${entry.cashPayment}</td>
                      <td>₹${entry.expenses}</td>
                      <td class="total-sales">₹${sales}</td>
                      <td class="total-payments">₹${payments}</td>
                      <td class="${diffClass}">₹${diff}</td>
                      <td>${dayjs(entry.createdAt).format('D/M/YY')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Compute branch totals for summary table
  const branchTotals = useMemo(() => {
    const totals = {};
    filteredEntries.forEach((entry) => {
      const branchId = entry.branchId?._id || 'unknown';
      const branchName = entry.branchId?.name || 'Unknown Branch';
      if (!totals[branchId]) {
        totals[branchId] = {
          branchId,
          branchName,
          totalSales: 0,
          totalPayments: 0,
          expenses: 0,
          creditCardPayment: 0,
          upiPayment: 0,
          cashPayment: 0,
          createdAt: entry.createdAt, // Use the latest createdAt for display
          expenseDetails: [],
        };
      }
      totals[branchId].totalSales += (entry.systemSales || 0) + (entry.manualSales || 0) + (entry.onlineSales || 0);
      totals[branchId].totalPayments += (entry.creditCardPayment || 0) + (entry.upiPayment || 0) + (entry.cashPayment || 0) + (entry.expenses || 0);
      totals[branchId].expenses += entry.expenses || 0;
      totals[branchId].creditCardPayment += entry.creditCardPayment || 0;
      totals[branchId].upiPayment += entry.upiPayment || 0;
      totals[branchId].cashPayment += entry.cashPayment || 0;
      totals[branchId].expenseDetails.push(...(entry.expenseDetails || []));
      // Update createdAt to the latest date
      if (!totals[branchId].createdAt || dayjs(entry.createdAt).isAfter(dayjs(totals[branchId].createdAt))) {
        totals[branchId].createdAt = entry.createdAt;
      }
    });
    return Object.values(totals);
  }, [filteredEntries]);

  const lineChartData = useMemo(() => {
    let startDate, endDate;
    const today = dayjs().startOf('day');
    switch (dateFilter) {
      case 'Today':
        startDate = today;
        endDate = today.endOf('day');
        break;
      case 'Yesterday':
        startDate = today.subtract(1, 'day').startOf('day');
        endDate = today.subtract(1, 'day').endOf('day');
        break;
      case 'Last 7 Days':
        startDate = today.subtract(6, 'day').startOf('day');
        endDate = today.endOf('day');
        break;
      case 'Last 30 Days':
        startDate = today.subtract(29, 'day').startOf('day');
        endDate = today.endOf('day');
        break;
      case 'Custom':
        if (customDateRange && customDateRange.length === 2) {
          startDate = dayjs(customDateRange[0]).startOf('day');
          endDate = dayjs(customDateRange[1]).endOf('day');
        }
        break;
      default:
        startDate = today;
        endDate = today.endOf('day');
    }
  
    if (!startDate || !endDate || !startDate.isValid() || !endDate.isValid()) {
      console.warn('Invalid date range:', { startDate, endDate });
      return { labels: [], datasets: [], maxValue: 1 };
    }
  
    const daysDiff = endDate.diff(startDate, 'day') + 1;
    const labels = Array.from({ length: daysDiff }, (_, i) =>
      startDate.add(i, 'day').format('D/M/YY')
    );
  
    const dailySales = Array(daysDiff).fill(0);
    const dailyPayments = Array(daysDiff).fill(0);
    const dailyExpenses = Array(daysDiff).fill(0);
  
    if (filteredEntries.length === 0) {
      console.warn('No filtered entries available for chart');
    }
  
    filteredEntries.forEach((entry) => {
      const entryDate = dayjs(dateFilterType === 'Created' ? entry.createdAt : entry.date);
      if (!entryDate.isValid()) {
        console.warn('Invalid entry date:', { entryDate, entry });
        return;
      }
      if (entryDate.isBetween(startDate, endDate, null, '[]')) {
        const dayIndex = entryDate.startOf('day').diff(startDate, 'day');
        if (dayIndex >= 0 && dayIndex < daysDiff) {
          const sales = (entry.systemSales || 0) + (entry.manualSales || 0) + (entry.onlineSales || 0);
          const payments = (entry.creditCardPayment || 0) + (entry.upiPayment || 0) + (entry.cashPayment || 0) + (entry.expenses || 0);
          dailySales[dayIndex] += sales;
          dailyPayments[dayIndex] += payments;
          dailyExpenses[dayIndex] += entry.expenses || 0;
        } else {
          console.warn('Invalid dayIndex:', { dayIndex, entryDate, startDate });
        }
      }
    });
  
    const maxValue = Math.max(...dailySales, ...dailyPayments, ...dailyExpenses, 1);
  
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
  }, [filteredEntries, dateFilter, customDateRange, dateFilterType]);

  const lineChartOptions = {
    layout: {
      padding: { left: 0, right: 0, top: 20, bottom: 0 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ₹${context.raw || 0}`,
        },
      },
      datalabels: {
        display: true,
        color: '#FF0000',
        formatter: (value) => `₹${value}`,
        align: 'top',
        anchor: 'end',
        offset: 5,
        font: { weight: 'bold', size: 10 },
        textAlign: 'center',
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Date', font: { weight: 'bold' } },
        ticks: { autoSkip: false, padding: 0 },
        grid: { offset: false },
        offset: false,
      },
      y: {
        title: { display: true, text: 'Amount (₹)', font: { weight: 'bold' } },
        beginAtZero: true,
        max: Math.ceil(lineChartData.maxValue * 1.1),
        ticks: { callback: (value) => `₹${value}` },
      },
    },
    maintainAspectRatio: false,
  };

  const customLineChartLegend = lineChartData.datasets.map((dataset, index) => (
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
        {dataset.label}: ₹{dataset.data.reduce((sum, value) => sum + (value || 0), 0)}
      </Text>
    </div>
  ));

  const barChartData = useMemo(() => {
    const salesByBranch = {};
    const dataSource = showSummaryTable ? branchTotals : filteredEntries;
    dataSource.forEach((entry) => {
      const branchName = showSummaryTable ? entry.branchName : (entry.branchId?.name || 'Unknown Branch');
      const sales = showSummaryTable
        ? entry.totalSales
        : ((entry.systemSales || 0) + (entry.manualSales || 0) + (entry.onlineSales || 0));
      salesByBranch[branchName] = (salesByBranch[branchName] || 0) + sales;
    });

    const labels = Object.keys(salesByBranch);
    const data = Object.values(salesByBranch);
    const maxValue = Math.max(...data, 1);

    return {
      labels,
      datasets: [
        {
          label: 'Total Sales',
          data,
          backgroundColor: '#9966FF',
          borderColor: '#9966FF',
          borderWidth: 1,
        },
      ],
      maxValue,
    };
  }, [filteredEntries, branchTotals, showSummaryTable]);

  const barChartOptions = {
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { weight: 'bold' } },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ₹${context.raw || 0}`,
        },
      },
      datalabels: {
        color: '#FF0000',
        anchor: 'end',
        align: 'top',
        offset: 5,
        formatter: (value) => `₹${value}`,
        font: { weight: 'bold', size: 12 },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Branch', font: { weight: 'bold' } },
        ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 },
      },
      y: {
        title: { display: true, text: 'Total Sales (₹)', font: { weight: 'bold' } },
        beginAtZero: true,
        max: Math.ceil(barChartData.maxValue * 1.1),
        ticks: { callback: (value) => `₹${value}` },
      },
    },
    maintainAspectRatio: false,
    barThickness: 30,
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
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225',
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
      datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 1 }],
    };
  }, [filteredEntries]);

  const pieChartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: {
          color: '#000',
          font: { weight: 'bold', size: 14 },
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
          return percentage >= 0.5;
        },
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 3,
        padding: 6,
        formatter: (value, context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
          return `₹${value} (${percentage}%)`;
        },
        align: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? 'end' : 'center';
        },
        anchor: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? 'end' : 'center';
        },
        offset: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          return percentage >= 1 && percentage <= 3 ? -10 : 0;
        },
        font: (context) => {
          const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
          const percentage = total > 0 ? (context.dataset.data[context.dataIndex] / total) * 100 : 0;
          let fontSize = percentage < 1 ? 10 : percentage <= 5 ? 14 : 16;
          return { weight: 'bold', size: fontSize };
        },
        textAlign: 'center',
      },
    },
    maintainAspectRatio: false,
  };

  const expenseColumns = [
    { title: 'S.No', key: 'sno', render: (text, record, index) => index + 1, width: 80 },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (value) => <Text strong>{value || 'N/A'}</Text> },
    { title: 'Recipient', dataIndex: 'recipient', key: 'recipient', render: (value) => <Text strong>{value || 'N/A'}</Text> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (value) => <Text strong>₹{value || 0}</Text>, align: 'right' },
  ];

  const summaryColumns = [
    { title: 'S.No', key: 'sno', render: (text, record, index) => <Text strong>{index + 1}</Text>, width: 60 },
    { 
      title: 'Branch', 
      dataIndex: 'branchName', 
      key: 'branch', 
      render: (value) => <Text strong>{value || 'N/A'}</Text>, 
      width: 120 
    },
    {
      title: 'Credit Card',
      dataIndex: 'creditCardPayment',
      key: 'creditCardPayment',
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
    },
    {
      title: 'UPI',
      dataIndex: 'upiPayment',
      key: 'upiPayment',
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
    },
    {
      title: 'Cash',
      dataIndex: 'cashPayment',
      key: 'cashPayment',
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
    },
    {
      title: 'Expenses',
      dataIndex: 'expenses',
      key: 'expenses',
      render: (value, record) => (
        <Text
          strong
          style={{ fontSize: '16px', cursor: value > 0 ? 'pointer' : 'default' }}
          onClick={() => value > 0 && handleViewExpenses(record, record.branchName, null)}
        >
          ₹{value}
        </Text>
      ),
      width: 140,
    },
    {
      title: 'Total Sales',
      dataIndex: 'totalSales',
      key: 'totalSales',
      sorter: (a, b) => a.totalSales - b.totalSales,
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
      onHeaderCell: () => ({
        style: { backgroundColor: 'rgb(220, 248, 198)' },
      }),
      onCell: () => ({
        style: { backgroundColor: 'rgb(220, 248, 198)' },
      }),
    },
    {
      title: 'Total Payments',
      dataIndex: 'totalPayments',
      key: 'totalPayments',
      sorter: (a, b) => a.totalPayments - b.totalPayments,
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
      onHeaderCell: () => ({
        style: { backgroundColor: '#50e0ff' },
      }),
      onCell: () => ({
        style: { backgroundColor: '#50e0ff' },
      }),
    },
   // In summaryColumns
{
  title: 'Difference',
  key: 'difference',
  sorter: (a, b) => (a.totalPayments - a.totalSales) - (b.totalPayments - b.totalSales),
  render: (record) => {
    const diff = record.totalPayments - record.totalSales;
    let backgroundColor, textColor;
    if (diff === 0) {
      backgroundColor = '#52c41a';
      textColor = '#ffffff';
    } else if (diff < 0) {
      backgroundColor = '#ff4d4f';
      textColor = '#ffffff';
    } else {
      backgroundColor = '#fadb14';
      textColor = '#000000';
    }
    return (
      <Text strong style={{ color: textColor, padding: '4px 8px', borderRadius: '4px' }}>
        ₹{diff}
      </Text>
    );
  },
  onCell: (record) => {
    const diff = record.totalPayments - record.totalSales;
    let backgroundColor;
    if (diff === 0) {
      backgroundColor = '#52c41a';
    } else if (diff < 0) {
      backgroundColor = '#ff4d4f';
    } else {
      backgroundColor = '#fadb14';
    }
    return {
      style: { backgroundColor },
    };
  },
  onHeaderCell: () => ({
    style: { backgroundColor: '#FCC6C8' },
  }),
  width: 120,
},
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (date) => (
        <Tooltip title={dayjs(date).format('D/M/YY hh:mm A')}>
          <Text strong>{date ? dayjs(date).format('D/M/YY') : 'N/A'}</Text>
        </Tooltip>
      ),
      width: 100,
    },
  ];

  const detailedColumns = [
    { title: 'S.No', key: 'sno', render: (text, record, index) => <Text strong>{index + 1}</Text>, width: 60 },
    { 
      title: 'Branch', 
      dataIndex: ['branchId', 'name'], 
      key: 'branch', 
      render: (value) => <Text strong>{value || 'N/A'}</Text>, 
      width: 120 
    },
    {
      title: 'Credit Card',
      dataIndex: 'creditCardPayment',
      key: 'creditCardPayment',
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
    },
    {
      title: 'UPI',
      dataIndex: 'upiPayment',
      key: 'upiPayment',
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
    },
    {
      title: 'Cash',
      dataIndex: 'cashPayment',
      key: 'cashPayment',
      render: (value) => <Text strong>₹{value}</Text>,
      width: 120,
    },
    {
      title: 'Expenses',
      dataIndex: 'expenses',
      key: 'expenses',
      render: (value, record) => (
        <Text
          strong
          style={{ fontSize: '16px', cursor: value > 0 ? 'pointer' : 'default' }}
          onClick={() => value > 0 && handleViewExpenses(record, record.branchId?.name, record.date)}
        >
          ₹{value}
        </Text>
      ),
      width: 140,
    },
    {
      title: 'Total Sales',
      key: 'totalSales',
      sorter: (a, b) => (a.systemSales + a.manualSales + a.onlineSales) - (b.systemSales + b.manualSales + b.onlineSales),
      render: (record) => <Text strong>₹{record.systemSales + record.manualSales + record.onlineSales}</Text>,
      width: 120,
      onHeaderCell: () => ({
        style: { backgroundColor: 'rgb(220, 248, 198)' },
      }),
      onCell: () => ({
        style: { backgroundColor: 'rgb(220, 248, 198)' },
      }),
    },
    {
      title: 'Total Payments',
      key: 'totalPayments',
      sorter: (a, b) => (a.creditCardPayment + a.upiPayment + a.cashPayment + a.expenses) - (b.creditCardPayment + b.upiPayment + b.cashPayment + b.expenses),
      render: (record) => <Text strong>₹{record.creditCardPayment + record.upiPayment + record.cashPayment + record.expenses}</Text>,
      width: 120,
      onHeaderCell: () => ({
        style: { backgroundColor: '#50e0ff' },
      }),
      onCell: () => ({
        style: { backgroundColor: '#50e0ff' },
      }),
    },
    // In detailedColumns
    {
      title: 'Difference',
      key: 'difference',
      render: (record) => {
        const sales = record.systemSales + record.manualSales + record.onlineSales;
        const payments = record.creditCardPayment + record.upiPayment + record.cashPayment + record.expenses;
        const diff = payments - sales;
        let backgroundColor, textColor;
        if (diff === 0) {
          backgroundColor = '#52c41a';
          textColor = '#ffffff';
        } else if (diff < 0) {
          backgroundColor = '#ff4d4f';
          textColor = '#ffffff';
        } else {
          backgroundColor = '#fadb14';
          textColor = '#000000';
        }
        return (
          <Text strong style={{ color: textColor, padding: '4px 8px', borderRadius: '4px' }}>
            ₹{diff}
          </Text>
        );
      },
      onCell: (record) => {
        const sales = record.systemSales + record.manualSales + record.onlineSales;
        const payments = record.creditCardPayment + record.upiPayment + record.cashPayment + record.expenses;
        const diff = payments - sales;
        let backgroundColor;
        if (diff === 0) {
          backgroundColor = '#52c41a';
        } else if (diff < 0) {
          backgroundColor = '#ff4d4f';
        } else {
          backgroundColor = '#fadb14';
        }
        return {
          style: { backgroundColor },
        };
      },
      onHeaderCell: () => ({
        style: { backgroundColor: '#FCC6C8' },
      }),
      width: 120,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (date) => (
        <Tooltip title={dayjs(date).format('D/M/YY hh:mm A')}>
          <Text strong>{date ? dayjs(date).format('D/M/YY') : 'N/A'}</Text>
        </Tooltip>
      ),
      width: 100,
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
            body { margin: 0; padding: 0; background: #fff; }
            .ant-card, .graphs-section { display: none; }
            .ant-table { font-size: 10px; }
            .ant-table th, .ant-table td { padding: 4px !important; font-weight: bold; }
            @page { size: A4; margin: 10mm; }
            .total-sales { background-color: rgb(220, 248, 198); }
            .total-payments { background-color: #50e0ff; }
          }
          .filter-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background: #fff;
            margin-bottom: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-radius: 12px;
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
            justify-content: flex-start;
            width: 100%;
            max-width: 1600px;
            gap: 20px;
          }
          .lower-graphs {
            display: flex;
            flex-direction: row;
            justify-content: center;
            width: 100%;
            max-width: 1600px;
            gap: 20px;
          }
          .chart-container.line {
            width: 100%;
            max-width: 1600px;
            height: 50vh;
            min-height: 400px;
            min-width: 900px;
          }
          .chart-container.bar {
            width: 50%;
            max-width: 800px;
            height: 50vh;
            min-height: 400px;
            min-width: 400px;
          }
          .chart-container.pie {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 50%;
            max-width: 800px;
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
            justify-content: flex-start;
            align-items: center;
          }
          .pie-card, .bar-card {
            max-width: 800px;
            justify-content: center;
          }
          .line-card {
            max-width: 1600px;
          }
          .chart-legend-bottom-left {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding: 10px 0;
          }
          .chart-legend-bottom-left .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          }
          .chart-legend-bottom-left .legend-item span {
            margin-right: 8px;
          }
          @media (max-width: 1200px) {
            .upper-graphs { flex-direction: column; align-items: flex-start; }
            .lower-graphs { flex-direction: column; align-items: center; }
            .chart-container.line { width: 95vw; max-width: 1200px; min-width: 700px; height: 45vh; min-height: 350px; }
            .chart-container.bar { width: 95vw; max-width: 600px; min-width: 500px; height: 45vh; min-height: 350px; }
            .chart-container.pie { width: 95vw; max-width: 600px; min-width: 500px; height: 55vh; min-height: 400px; }
            .line-card, .bar-card, .pie-card { max-width: 100%; }
          }
          @media (max-width: 768px) {
            .chart-container.line { width: 98vw; max-width: 1000px; min-width: 400px; height: 40vh; min-height: 300px; }
            .chart-container.bar { width: 98vw; max-width: 500px; min-width: 400px; height: 40vh; min-height: 300px; }
            .chart-container.pie { width: 98vw; max-width: 500px; min-width: 400px; height: 50vh; min-height: 350px; }
          }
          @media (max-width: 480px) {
            .chart-container.line { width: 98vw; max-width: 850px; min-width: 300px; height: 35vh; min-height: 250px; }
            .chart-container.bar { width: 98vw; max-width: 400px; min-width: 300px; height: 35vh; min-height: 250px; }
            .chart-container.pie { width: 98vw; max-width: 400px; min-width: 350px; height: 45vh; min-height: 300px; }
          }
          @media (max-width: 768px) {
            .custom-legend { flex-direction: column; align-items: flex-start; }
            .custom-legend > div { margin-bottom: 10px; margin-right: 0; }
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
              className="filter-header"
              style={{
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
                      value={dateFilter}
                      onChange={(value) => {
                        setDateFilter(value);
                        if (value !== 'Custom') setCustomDateRange(null);
                      }}
                      style={{ width: '150px' }}
                    >
                      <Option value="Today">Today</Option>
                      <Option value="Yesterday">Yesterday</Option>
                      <Option value="Last 7 Days">Last 7 Days</Option>
                      <Option value="Last 30 Days">Last 30 Days</Option>
                      <Option value="Custom">Custom</Option>
                    </Select>
                    <RangePicker
                      value={customDateRange}
                      onChange={(dates) => setCustomDateRange(dates)}
                      format="D/M/YY"
                      style={{ width: '250px' }}
                      disabled={dateFilter !== 'Custom'}
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
                    {expenseCategories.map((category) => (
                      <Option key={category} value={category}>
                        {category.charAt(0) + category.slice(1).toLowerCase()}
                      </Option>
                    ))}
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Text strong>Table View</Text>
                  <Switch
                    checked={showSummaryTable}
                    onChange={(checked) => setShowSummaryTable(checked)}
                    checkedChildren="Summary"
                    unCheckedChildren="Detailed"
                  />
                </div>

                <Space style={{ marginTop: '20px' }}>
                  <Button icon={<PrinterOutlined />} onClick={handlePrint} />
                  <Button type="default" icon={<RedoOutlined />} onClick={handleReset}>
                    Reset
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
                columns={showSummaryTable ? summaryColumns : detailedColumns}
                dataSource={showSummaryTable ? branchTotals : filteredEntries}
                rowKey={showSummaryTable ? 'branchId' : '_id'}
                pagination={{ pageSize: 10 }}
                bordered
              />
            </Card>

            {filteredEntries.length > 0 ? (
              <div className="graphs-section">
                <Card className="line-card">
                  <div style={{ textAlign: 'left' }}>
                    <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '10px' }}>
                      Daily Trends ({dateFilter})
                    </Text>
                    <div className="custom-legend" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
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